/**
 * Adsplay Labs TV — Smart Media: ingestão de vendas por e-mail.
 *
 * Lê os e-mails de venda que chegam em entradadecampanha@adsplay.com.br,
 * extrai os campos fixos (SQUAD, STATUS, PI, INVESTIMENTO, PERIODO, SDR,
 * EXECUTIVO, CS) e grava cada venda na coleção `sales` do Firestore.
 *
 * Roda como Google Apps Script (gratuito, hospedado pelo Google) na própria
 * conta entradadecampanha@, com um gatilho time-driven. O Player (TV) assina
 * a coleção `sales` em tempo real via onSnapshot.
 *
 * >>> NÃO comite chaves aqui. Os segredos ficam em Script Properties. <<<
 * Veja integrations/README.md para o passo a passo de instalação.
 */

// ----------------------------------------------------------------------------
// Configuração (valores não-secretos podem ficar aqui)
// ----------------------------------------------------------------------------
var PROJECT_ID = 'ai-studio-applet-webapp-a4037';
var DATABASE_ID = 'ai-studio-6747962b-4319-4fcd-b642-b54dbe551a9d';
var COLLECTION = 'sales';

// Filtro do Gmail. Recomendado: crie um filtro que rotula as vendas como
// "Vendas" e busque por essa label. Fallback: e-mails não lidos para a caixa.
var GMAIL_QUERY = 'to:entradadecampanha@adsplay.com.br is:unread';
var PROCESSED_LABEL = 'Processado';

// ----------------------------------------------------------------------------
// Ponto de entrada — agende esta função no gatilho time-driven (a cada 5 min).
// ----------------------------------------------------------------------------
function processSalesInbox() {
  var label = getOrCreateLabel_(PROCESSED_LABEL);
  var threads = GmailApp.search(GMAIL_QUERY, 0, 25);
  var token = getAccessToken_();

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      try {
        var sale = parseSaleEmail_(message);
        if (!sale) return; // não casou o padrão — ignora
        var docId = message.getId(); // idempotência: 1 e-mail = 1 doc
        var created = writeSale_(token, docId, sale);
        if (created) {
          Logger.log('Venda gravada: ' + docId + ' (' + sale.squad + ')');
        } else {
          Logger.log('Já existia, pulando: ' + docId);
        }
      } catch (err) {
        Logger.log('Erro processando mensagem ' + message.getId() + ': ' + err);
      }
    });
    thread.markRead();
    thread.addLabel(label);
  });
}

// ----------------------------------------------------------------------------
// Parsing do corpo do e-mail
// ----------------------------------------------------------------------------
function parseSaleEmail_(message) {
  var body = message.getPlainBody() || '';

  var field = function (name) {
    // Captura "NOME: valor" até o fim da linha. [ \t]* após os dois-pontos
    // evita cruzar a quebra de linha quando o campo está vazio (ex.: PERIODO:).
    var re = new RegExp(name + '[ \\t]*:[ \\t]*(.*)', 'i');
    var m = body.match(re);
    return m ? m[1].trim() : '';
  };

  var squad = field('SQUAD');
  var status = field('STATUS');
  var pi = field('PI');
  var investimentoStr = field('INVESTIMENTO');
  var periodo = field('PERIODO') || field('PERÍODO');
  var sdr = field('SDR');
  var executivo = field('EXECUTIVO');
  var cs = field('CS');

  // Exige ao menos um campo essencial para considerar uma venda válida.
  if (!squad && !investimentoStr && !executivo) return null;

  return {
    squad: squad,
    status: status,
    pi: pi,
    investimento: investimentoStr,
    investimentoValor: parseBRL_(investimentoStr),
    periodo: periodo || 'A definir',
    sdr: sdr,
    executivo: executivo,
    cs: cs,
    emailFrom: message.getFrom(),
    soldAt: message.getDate().getTime()
  };
}

/** Converte "R$ 80.000,00" -> 80000 (número). */
function parseBRL_(str) {
  if (!str) return 0;
  var cleaned = str.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.');
  var n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ----------------------------------------------------------------------------
// Firestore REST API (cria documento com ID fixo; 409 = já existe)
// ----------------------------------------------------------------------------
function writeSale_(token, docId, sale) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
    '/databases/' + DATABASE_ID + '/documents/' + COLLECTION +
    '?documentId=' + encodeURIComponent(docId);

  var payload = {
    fields: {
      squad: { stringValue: sale.squad },
      status: { stringValue: sale.status },
      pi: { stringValue: sale.pi },
      investimento: { stringValue: sale.investimento },
      investimentoValor: { doubleValue: sale.investimentoValor },
      periodo: { stringValue: sale.periodo },
      sdr: { stringValue: sale.sdr },
      executivo: { stringValue: sale.executivo },
      cs: { stringValue: sale.cs },
      emailFrom: { stringValue: sale.emailFrom },
      soldAt: { integerValue: String(sale.soldAt) },
      createdAt: { integerValue: String(Date.now()) },
      sourceMessageId: { stringValue: docId }
    }
  };

  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  if (code === 200) return true;
  if (code === 409) return false; // documento já existe (idempotente)
  throw new Error('Firestore respondeu ' + code + ': ' + resp.getContentText());
}

// ----------------------------------------------------------------------------
// Autenticação: service account JWT -> OAuth access token (escopo datastore)
// Chave guardada em Script Properties: SA_CLIENT_EMAIL, SA_PRIVATE_KEY
// ----------------------------------------------------------------------------
function getAccessToken_() {
  var props = PropertiesService.getScriptProperties();
  var clientEmail = props.getProperty('SA_CLIENT_EMAIL');
  var privateKey = props.getProperty('SA_PRIVATE_KEY');
  if (!clientEmail || !privateKey) {
    throw new Error('Faltam SA_CLIENT_EMAIL / SA_PRIVATE_KEY em Script Properties.');
  }
  privateKey = privateKey.replace(/\\n/g, '\n'); // restaura quebras de linha

  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'JWT' };
  var claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  var toSign = base64url_(JSON.stringify(header)) + '.' + base64url_(JSON.stringify(claim));
  var signature = Utilities.computeRsaSha256Signature(toSign, privateKey);
  var jwt = toSign + '.' + base64url_(signature);

  var resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    },
    muteHttpExceptions: true
  });

  var data = JSON.parse(resp.getContentText());
  if (!data.access_token) {
    throw new Error('Falha ao obter access token: ' + resp.getContentText());
  }
  return data.access_token;
}

function base64url_(input) {
  var bytes = (typeof input === 'string') ? Utilities.newBlob(input).getBytes() : input;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

// ----------------------------------------------------------------------------
// Utilitários de setup (rode manualmente uma vez)
// ----------------------------------------------------------------------------

/** Cria o gatilho time-driven a cada 5 minutos. Rode uma vez. */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processSalesInbox') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processSalesInbox').timeBased().everyMinutes(5).create();
  Logger.log('Gatilho instalado: processSalesInbox a cada 5 min.');
}

/** Testa o parsing + uma escrita usando o corpo de exemplo. */
function testParseAndWrite() {
  var token = getAccessToken_();
  var fakeSale = {
    squad: 'Tratores', status: 'Programática', pi: 'Renovação',
    investimento: 'R$ 80.000,00', investimentoValor: 80000,
    periodo: 'A definir', sdr: 'Rayanne Moura',
    executivo: 'Fernanda Miguez, Mayalú Andrade', cs: 'Thyago Soares',
    emailFrom: 'teste@adsplay.com.br', soldAt: Date.now()
  };
  var created = writeSale_(token, 'TESTE_' + Date.now(), fakeSale);
  Logger.log('Escrita de teste OK. Criado: ' + created);
}
