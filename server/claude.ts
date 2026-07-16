import Anthropic from '@anthropic-ai/sdk';
import type { RawEmail } from './gmail';
import { getRecentCorrections, getRecentConfirmations, type FeedbackRow } from './db';

const client = new Anthropic();

// O spec original pedia claude-sonnet-4-20250514, que foi aposentado em jun/2026.
// claude-sonnet-5 é o substituto direto da linha Sonnet.
const MODEL = 'claude-sonnet-5';

export type Category = 'alta' | 'media' | 'lixo';

export interface Classification {
  id: string;
  category: Category;
  reason: string;
}

// Prompt estável — nunca interpolar datas/IDs aqui, senão o cache invalida.
const SYSTEM_PROMPT = `Você é um classificador de emails para Bruno, COO da Adsplay (adtech brasileira de mídia programática). Ele também é sócio da Pixel Roads e Ctrl365.

Classifique cada email não lido em exatamente uma categoria:

## alta — Alta Prioridade (ação imediata)
- Emails de pessoas da equipe (@adsplay.com.br, @the365group.com.br) que pedem decisão ou resposta
- Alertas de segurança (Google Workspace admin, senha, spam spike)
- Lembretes que o próprio Bruno enviou para si mesmo
- Convites de reunião futuros que ele precisa responder
- Clientes ou parceiros ativos com pendência real (ex.: Azerion, WPP, Certta)

## media — Média (verificar hoje, sem urgência)
- Atualizações de ferramentas que ele usa (Xandr, Meta, Google Ads aprovações)
- Google Alerts sobre a marca ou sobre ele mesmo
- Propostas comerciais que parecem personalizadas e relevantes
- Comunicados internos informativos (sem pedido de ação)
- Notificações de plataformas (Anthropic, QultureRocks)

## lixo — Lixo (pode ignorar / marcar como lido)
- Newsletters e digests (Meio & Mensagem, G4, Pipeline Capital)
- Cold outreach genérico e prospecção não solicitada
- Marketing/promoções (Mercado Pago, FIFA store)
- Disparos da própria Adsplay (mkt@adsplay.com.br)
- Convites de eventos que já passaram
- Bounces e notificações automáticas sem valor

Regras:
- Na dúvida entre alta e media, escolha media.
- Na dúvida entre media e lixo, considere: o remetente conhece o Bruno de verdade? Se não, lixo.
- O feedback do usuário (fornecido a cada chamada) tem precedência sobre essas regras — aprenda com ele.`;

function formatFeedback(corrections: FeedbackRow[], confirmations: FeedbackRow[]): string {
  if (corrections.length === 0 && confirmations.length === 0) {
    return 'Nenhum feedback registrado ainda.';
  }

  let out = '';
  if (corrections.length > 0) {
    out += 'VOCÊ ERROU ESTES EMAILS — não repita esses erros:\n';
    for (const c of corrections) {
      out += `- de "${c.sender}", assunto "${c.subject}": você disse "${c.original_category}", o correto é "${c.confirmed_category}"\n`;
    }
  }
  if (confirmations.length > 0) {
    out += '\nVOCÊ ACERTOU ESTES — mantenha esse padrão:\n';
    for (const c of confirmations) {
      out += `- de "${c.sender}", assunto "${c.subject}": "${c.confirmed_category}" ✓\n`;
    }
  }
  return out;
}

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    classifications: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, description: 'ID do email, copiado exatamente da entrada' },
          category: { type: 'string' as const, enum: ['alta', 'media', 'lixo'] },
          reason: { type: 'string' as const, description: 'Justificativa em uma frase curta' },
        },
        required: ['id', 'category', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['classifications'],
  additionalProperties: false,
};

/**
 * Call 2 do padrão de dois calls: recebe emails crus (já buscados via Gmail)
 * e retorna JSON estruturado. Nunca mistura busca e classificação.
 */
export async function classifyEmails(emails: RawEmail[]): Promise<Classification[]> {
  const corrections = getRecentCorrections(20);
  const confirmations = getRecentConfirmations(10);

  const emailList = emails
    .map(
      (e) =>
        `<email id="${e.id}">\nDe: ${e.sender} <${e.senderEmail}>\nAssunto: ${e.subject}\nPrévia: ${e.snippet.slice(0, 200)}\n</email>`
    )
    .join('\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // Prefixo estável — cacheia as instruções entre cliques de "Atualizar".
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `## Histórico de feedback\n${formatFeedback(corrections, confirmations)}`,
            // Muda só quando chega feedback novo — segundo breakpoint de cache.
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `## Emails para classificar\n${emailList}`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Classificação recusada pelo modelo.');
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Resposta sem conteúdo de texto.');
  }

  const parsed = JSON.parse(textBlock.text) as { classifications: Classification[] };
  return parsed.classifications;
}
