import {
  PLAYBOOKS, VERTICAL_SIGNALS, GOAL_SIGNALS, GOAL_META, monthName,
  type Vertical, type Goal, type PlaybookEntry,
} from "./playbook";

// ─── Tipos da análise ────────────────────────────────────────────────────────

export type Confidence = "detectado" | "sugerido" | "nao_informado";

export interface Reading {
  /** o que a IA entendeu do negócio, em uma frase */
  business: string;
  vertical: Vertical;
  verticalConfidence: Confidence;
  goal: Goal;
  goalConfidence: Confidence;
  /** em reais, número puro */
  budget: number;
  budgetConfidence: Confidence;
  startDate: string;
  endDate: string;
  periodLabel: string;
  periodConfidence: Confidence;
  /** alerta de sazonalidade, vazio se não houver */
  seasonAlert: string;
  /** o que a IA faria além do que foi pedido */
  plays: { icon: string; title: string; text: string }[];
  /** pontos que o cliente não mencionou e valem atenção */
  gaps: string[];
  /** origem da análise, para a UI ser honesta sobre isso */
  source: "gemini" | "local";
}

export interface Estimate {
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
}

// ─── Estimativa de entrega ───────────────────────────────────────────────────
//
// ⚠️ Usa os CPMs de referência do playbook, que são PLACEHOLDERS.
// Não é previsão de entrega real. A UI sempre exibe essa ressalva junto.

export function estimate(budget: number, pb: PlaybookEntry): Estimate {
  const impressions = budget > 0 ? Math.round((budget / pb.refCpm) * 1000) : 0;
  const clicks = budget > 0 ? Math.round(budget / pb.refCpc) : 0;
  return { impressions, clicks, cpm: pb.refCpm, cpc: pb.refCpc };
}

export function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return n.toLocaleString("pt-BR");
}

// ─── Leitor de site (Jina) ───────────────────────────────────────────────────

export async function readSite(url: string): Promise<string> {
  const clean = url.trim().replace(/^https?:\/\//, "");
  if (!clean) return "";
  try {
    const res = await fetch(`https://r.jina.ai/https://${clean}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return "";
    const text = await res.text();
    // corta para não estourar token à toa no prompt
    return text.slice(0, 4000);
  } catch {
    return "";
  }
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
export const hasGemini = Boolean(GEMINI_KEY);

const SYSTEM_PROMPT = `Você é um head de mídia programática sênior brasileiro. Um cliente descreveu o negócio dele em texto livre e você precisa transformar isso em uma campanha estruturada.

Sua função não é só extrair o que ele escreveu. É pensar ALÉM: apontar o que ele não considerou, o que costuma dar errado nesse tipo de campanha, e qual seria o próximo movimento de quem faz isso há anos.

Regras:
- Fale em português brasileiro, direto, sem jargão de agência.
- Nunca invente número de mercado. Se não sabe, não afirma.
- Quando o cliente não informou algo (verba, período, objetivo), marque como "sugerido" ou "nao_informado" — não finja que ele disse.
- Os "plays" são movimentos estratégicos que ELE NÃO PEDIU mas que você faria. Seja específico ao negócio dele, não genérico.
- Os "gaps" são perguntas ou pontos cegos que ele deixou em aberto.

Responda APENAS com JSON válido, sem markdown, neste formato exato:
{
  "business": "descrição do negócio em uma frase curta",
  "vertical": "moda|food|financeiro|app|generico",
  "verticalConfidence": "detectado|sugerido",
  "goal": "AWARENESS|ENGAJAMENTO|CONVERSAO|MISTO",
  "goalConfidence": "detectado|sugerido",
  "budget": número em reais ou 0 se não informado,
  "budgetConfidence": "detectado|sugerido|nao_informado",
  "periodDays": número de dias sugerido para a campanha,
  "periodLabel": "por que esse período",
  "periodConfidence": "detectado|sugerido",
  "seasonAlert": "alerta de sazonalidade se relevante, ou string vazia",
  "plays": [{"icon":"emoji","title":"título curto","text":"1-2 frases"}],
  "gaps": ["ponto que ficou em aberto", "..."]
}

Gere 3 plays e 2-3 gaps.`;

interface GeminiRaw {
  business?: string; vertical?: string; verticalConfidence?: string;
  goal?: string; goalConfidence?: string;
  budget?: number; budgetConfidence?: string;
  periodDays?: number; periodLabel?: string; periodConfidence?: string;
  seasonAlert?: string;
  plays?: { icon?: string; title?: string; text?: string }[];
  gaps?: string[];
}

async function callGemini(briefing: string, siteText: string): Promise<Reading | null> {
  if (!GEMINI_KEY) return null;

  const userPart = siteText
    ? `BRIEFING DO CLIENTE:\n${briefing}\n\nCONTEÚDO DO SITE DELE:\n${siteText}`
    : `BRIEFING DO CLIENTE:\n${briefing}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPart }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1400, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const raw: GeminiRaw = JSON.parse(text);
    const vertical = (raw.vertical && raw.vertical in PLAYBOOKS ? raw.vertical : "generico") as Vertical;
    const goal = (raw.goal && raw.goal in GOAL_META ? raw.goal : "MISTO") as Goal;
    const days = raw.periodDays && raw.periodDays > 0 ? raw.periodDays : 30;
    const { start, end } = datesFromToday(days);

    return {
      business: raw.business || "Negócio não identificado",
      vertical,
      verticalConfidence: raw.verticalConfidence === "detectado" ? "detectado" : "sugerido",
      goal,
      goalConfidence: raw.goalConfidence === "detectado" ? "detectado" : "sugerido",
      budget: typeof raw.budget === "number" ? raw.budget : 0,
      budgetConfidence: normConf(raw.budgetConfidence, raw.budget),
      startDate: start,
      endDate: end,
      periodLabel: raw.periodLabel || `${days} dias`,
      periodConfidence: raw.periodConfidence === "detectado" ? "detectado" : "sugerido",
      seasonAlert: raw.seasonAlert || "",
      plays: (raw.plays || []).slice(0, 4).map(p => ({
        icon: p.icon || "💡", title: p.title || "", text: p.text || "",
      })).filter(p => p.title),
      gaps: (raw.gaps || []).slice(0, 4).filter(Boolean),
      source: "gemini",
    };
  } catch {
    return null;
  }
}

function normConf(c: string | undefined, budget: number | undefined): Confidence {
  if (!budget || budget <= 0) return "nao_informado";
  if (c === "detectado") return "detectado";
  if (c === "nao_informado") return "nao_informado";
  return "sugerido";
}

// ─── Análise local (fallback sem API key) ────────────────────────────────────

function datesFromToday(days: number) {
  const s = new Date();
  const e = new Date();
  e.setDate(e.getDate() + days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(s), end: iso(e) };
}

function detectVertical(text: string): { v: Vertical; conf: Confidence } {
  const low = text.toLowerCase();
  let best: Vertical = "generico";
  let bestHits = 0;
  (Object.keys(VERTICAL_SIGNALS) as Vertical[]).forEach(v => {
    const hits = VERTICAL_SIGNALS[v].filter(k => low.includes(k)).length;
    if (hits > bestHits) { bestHits = hits; best = v; }
  });
  return { v: best, conf: bestHits > 0 ? "detectado" : "sugerido" };
}

function detectGoal(text: string): { g: Goal; conf: Confidence } {
  const low = text.toLowerCase();
  let best: Goal = "MISTO";
  let bestHits = 0;
  (Object.keys(GOAL_SIGNALS) as Goal[]).forEach(g => {
    const hits = GOAL_SIGNALS[g].filter(k => low.includes(k)).length;
    if (hits > bestHits) { bestHits = hits; best = g; }
  });
  return { g: best, conf: bestHits > 0 ? "detectado" : "sugerido" };
}

function detectBudget(text: string): { b: number; conf: Confidence } {
  const low = text.toLowerCase().replace(/\./g, "").replace(/,/g, ".");
  // R$ 40k / 40 mil / R$ 40.000 / 40000 reais
  const kMatch = low.match(/(?:r\$\s*)?(\d+(?:\.\d+)?)\s*(k|mil)\b/);
  if (kMatch) return { b: Math.round(parseFloat(kMatch[1]) * 1000), conf: "detectado" };
  const rMatch = low.match(/r\$\s*(\d+(?:\.\d+)?)/);
  if (rMatch) return { b: Math.round(parseFloat(rMatch[1])), conf: "detectado" };
  const plain = low.match(/(\d{4,})\s*(?:reais|de verba|de investimento)/);
  if (plain) return { b: Math.round(parseFloat(plain[1])), conf: "detectado" };
  return { b: 0, conf: "nao_informado" };
}

function detectPeriod(text: string): { days: number; label: string; conf: Confidence } {
  const low = text.toLowerCase();
  const dMatch = low.match(/(\d+)\s*dias?/);
  if (dMatch) return { days: parseInt(dMatch[1]), label: `${dMatch[1]} dias, como você pediu`, conf: "detectado" };
  const mMatch = low.match(/(\d+)\s*(?:mês|mes|meses)/);
  if (mMatch) { const d = parseInt(mMatch[1]) * 30; return { days: d, label: `${mMatch[1]} mês(es), como você pediu`, conf: "detectado" }; }
  if (/natal|dezembro/.test(low)) return { days: 45, label: "45 dias para cobrir a rampa até o Natal", conf: "sugerido" };
  if (/black friday/.test(low)) return { days: 30, label: "30 dias para aquecer público antes da Black Friday", conf: "sugerido" };
  if (/lançamento|lancamento/.test(low)) return { days: 60, label: "60 dias — lançamento precisa de tempo para construir reconhecimento", conf: "sugerido" };
  return { days: 30, label: "30 dias, tempo mínimo para a campanha estabilizar e gerar aprendizado", conf: "sugerido" };
}

function seasonFor(pb: PlaybookEntry, startMonth: number): string {
  const hit = pb.seasonality.find(s => s.months.includes(startMonth));
  return hit ? hit.note : "";
}

function buildGaps(text: string, budget: number, pb: PlaybookEntry): string[] {
  const low = text.toLowerCase();
  const gaps: string[] = [];
  if (budget <= 0) gaps.push("Você não disse quanto pretende investir — coloquei uma verba de partida que dá para ajustar.");
  if (!/sp|são paulo|sao paulo|rio|rj|minas|mg|brasil|nacional|região|regiao/.test(low))
    gaps.push("Não ficou claro onde você quer anunciar. Sugeri praça, mas vale confirmar onde seu cliente realmente está.");
  if (!/pixel|conversão|conversao|rastrear|medir/.test(low))
    gaps.push("Você não mencionou pixel de rastreamento. Sem ele não dá para medir conversão nem fazer retargeting depois.");
  if (!/vídeo|video|banner|criativo|peça|peca/.test(low))
    gaps.push(`Não falou de criativo. ${pb.creativeHint}`);
  return gaps.slice(0, 3);
}

function localAnalysis(briefing: string, siteText: string): Reading {
  const full = `${briefing}\n${siteText}`;
  const { v, conf: vConf } = detectVertical(full);
  const { g, conf: gConf } = detectGoal(full);
  const { b, conf: bConf } = detectBudget(briefing);
  const { days, label, conf: pConf } = detectPeriod(briefing);
  const pb = PLAYBOOKS[v];
  const { start, end } = datesFromToday(days);
  const startMonth = new Date(start).getMonth();

  const goal = gConf === "detectado" ? g : pb.defaultGoal;
  const budget = b > 0 ? b : 10000;

  const firstLine = briefing.trim().split(/[.\n]/)[0]?.trim() || "";
  const business = firstLine.length > 8 && firstLine.length < 120
    ? firstLine.charAt(0).toUpperCase() + firstLine.slice(1)
    : `${pb.label} — negócio identificado pelo briefing`;

  return {
    business,
    vertical: v,
    verticalConfidence: vConf,
    goal,
    goalConfidence: gConf === "detectado" ? "detectado" : "sugerido",
    budget,
    budgetConfidence: bConf === "detectado" ? "detectado" : "sugerido",
    startDate: start,
    endDate: end,
    periodLabel: label,
    periodConfidence: pConf,
    seasonAlert: seasonFor(pb, startMonth),
    plays: pb.plays,
    gaps: buildGaps(briefing, b, pb),
    source: "local",
  };
}

// ─── Entrada pública ─────────────────────────────────────────────────────────

export async function analyze(briefing: string, siteUrl: string): Promise<Reading> {
  const siteText = siteUrl ? await readSite(siteUrl) : "";
  const fromGemini = await callGemini(briefing, siteText);
  if (fromGemini) {
    // se o Gemini não trouxe plays, completa com o playbook da vertical
    if (fromGemini.plays.length === 0) fromGemini.plays = PLAYBOOKS[fromGemini.vertical].plays;
    if (fromGemini.gaps.length === 0) fromGemini.gaps = buildGaps(briefing, fromGemini.budget, PLAYBOOKS[fromGemini.vertical]);
    return fromGemini;
  }
  return localAnalysis(briefing, siteText);
}

export { PLAYBOOKS, GOAL_META, monthName };
export type { Vertical, Goal, PlaybookEntry };
