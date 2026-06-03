# Smart Media — Ingestão de Vendas (Google Apps Script)

Este diretório contém o script que lê os e-mails de venda de
`entradadecampanha@adsplay.com.br` e grava cada venda na coleção `sales` do
Firestore. O card **Smart Media · Vendas** (`SMART_SALES`) no Player exibe essas
vendas na TV em tempo real.

> **Por que Apps Script?** O app é uma SPA puramente frontend (sem backend). Um
> navegador não consegue ficar lendo e-mail em segundo plano, e a TV roda o
> Player sem ninguém logado. O Apps Script é um componente **sempre ligado, fora
> do navegador**, gratuito e com acesso nativo ao Gmail. Ele escuta a caixa e
> grava no Firestore; a TV só lê.

## Fluxo

```
Gmail (entradadecampanha@)  ──gatilho a cada 5 min──▶  Apps Script
   parseia SQUAD/STATUS/PI/INVESTIMENTO/... ──REST(service account)──▶ Firestore `sales`
                                                          │
                                                   onSnapshot (tempo real)
                                                          ▼
                                                 Player SMART_SALES (TV)
```

## Passo a passo de instalação

### 1. Criar a service account (grava no Firestore)
1. Google Cloud Console → projeto **ai-studio-applet-webapp-a4037** → *IAM e
   administrador → Contas de serviço → Criar conta de serviço*.
2. Papel: **Cloud Datastore User** (`roles/datastore.user`).
3. Crie uma **chave JSON** e baixe. Você vai usar dois campos: `client_email` e
   `private_key`.

### 2. Criar o projeto Apps Script
1. Logado como **entradadecampanha@adsplay.com.br**, abra https://script.google.com → *Novo projeto*.
2. Cole o conteúdo de [`sales-ingestion.gs`](./sales-ingestion.gs).
3. *Configurações do projeto* → marque **Mostrar arquivo appsscript.json** e
   confirme que os escopos do Gmail/UrlFetch serão solicitados na 1ª execução.

### 3. Guardar os segredos em Script Properties
*Configurações do projeto → Propriedades do script → Adicionar propriedade*:

| Propriedade        | Valor                                                        |
|--------------------|--------------------------------------------------------------|
| `SA_CLIENT_EMAIL`  | o `client_email` do JSON                                     |
| `SA_PRIVATE_KEY`   | o `private_key` do JSON (cole inteiro, com `\n` ou quebras)  |

> O script já trata `\n` escapado. Nunca coloque a chave no código/repo.

### 4. Configurar o filtro do Gmail (recomendado)
Para robustez, crie um **filtro** no Gmail de entradadecampanha@ que aplique a
label `Vendas` aos e-mails de venda, e troque no script:

```js
var GMAIL_QUERY = 'label:Vendas -label:Processado';
```

(O padrão atual usa `is:unread`, que também funciona.)

### 5. Testar
1. No editor, rode **`testParseAndWrite`** → autorize os escopos quando pedido →
   confira no Firestore (coleção `sales`) que um doc de teste foi criado. Apague
   o doc de teste depois.
2. Envie um e-mail de venda real para a caixa e rode **`processSalesInbox`**
   manualmente. Confirme o doc criado com os campos certos. Rode 2x para validar
   a **idempotência** (não duplica — usa o ID da mensagem como ID do doc).

### 6. Agendar
Rode **`installTrigger`** uma vez para criar o gatilho time-driven (a cada 5 min).
Pronto — daí em diante roda sozinho.

## Campos gravados em `sales`

| Campo               | Tipo    | Origem                                  |
|---------------------|---------|-----------------------------------------|
| `squad`             | string  | `SQUAD:`                                |
| `status`            | string  | `STATUS:`                               |
| `pi`                | string  | `PI:`                                   |
| `investimento`      | string  | `INVESTIMENTO:` (texto original)        |
| `investimentoValor` | number  | valor normalizado (R$ 80.000,00 → 80000)|
| `periodo`           | string  | `PERIODO:` (vazio → "A definir")        |
| `sdr`               | string  | `SDR:`                                  |
| `executivo`         | string  | `EXECUTIVO:`                            |
| `cs`                | string  | `CS:`                                   |
| `emailFrom`         | string  | remetente do e-mail                     |
| `soldAt`            | number  | timestamp (ms) do e-mail                |
| `createdAt`         | number  | timestamp (ms) da gravação              |
| `sourceMessageId`   | string  | ID da mensagem Gmail (= ID do doc)      |

## Regras do Firestore
A coleção `sales` é **somente leitura** para clientes e gravável apenas pela
service account (que ignora as rules via REST). Já está em `firestore.rules`:

```
match /sales/{saleId} {
  allow read: if true;
  allow write: if false;
}
```

Publique as regras no Firebase Console (Firestore → Regras) — o Vercel não
publica regras.

## Observações
- **Latência**: ~ o intervalo do gatilho (5 min). Mínimo prático ~1 min. Para
  "no segundo em que chega" seria necessário Gmail Pub/Sub + Cloud Functions
  (fora do escopo atual).
- **Parsing robusto**: hoje é regex sobre os campos fixos. Se o formato variar
  muito, dá para acrescentar um fallback via Gemini (UrlFetchApp), como nos
  outros smart cards.
