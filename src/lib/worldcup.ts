// World Cup mode — shared data layer.
//
// Three "smart media" card types feed off live FIFA World Cup 2026 data:
//   WC_BRAZIL  — Brazil's journey (results so far) + next match
//   WC_TODAY   — today's matches
//   WC_BRACKET — the knockout bracket
//
// Data is fetched via Gemini + Google Search (same pattern as WEATHER/NEWS)
// and cached in the media payload on Firestore. It's HYBRID: an admin can
// review/override the fetched data in the panel and freeze auto-refresh
// (payload.autoRefresh === false) so their manual corrections stick.
import { GoogleGenAI } from '@google/genai';

export type WCType = 'WC_BRAZIL' | 'WC_TODAY' | 'WC_BRACKET';

export interface WCMatch {
  home: string;
  away: string;
  homeFlag?: string;
  awayFlag?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  date?: string;
  time?: string;
  stage?: string;
  status?: 'scheduled' | 'live' | 'finished';
}

export interface WCBrazilResult {
  opponent: string;
  opponentFlag?: string;
  brScore: number;
  advScore: number;
  stage?: string;
  date?: string;
}

export interface WCBrazilNext {
  opponent: string;
  opponentFlag?: string;
  date?: string;
  time?: string;
  stage?: string;
  venue?: string;
}

export interface WCBracketRound {
  name: string;
  matches: WCMatch[];
}

// How long a card's cached data stays fresh before the player refetches.
export const WC_CACHE_MS: Record<WCType, number> = {
  WC_TODAY: 15 * 60 * 1000, // 15 min — scores move during the day
  WC_BRAZIL: 60 * 60 * 1000, // 1h — changes only after a Brazil match
  WC_BRACKET: 60 * 60 * 1000, // 1h — changes only after knockout games
};

// V (vitória) / E (empate) / D (derrota) from Brazil's point of view.
export const wcResultLetter = (brScore: number, advScore: number): 'V' | 'E' | 'D' => {
  if (brScore > advScore) return 'V';
  if (brScore < advScore) return 'D';
  return 'E';
};

const buildPrompt = (type: WCType, now: string): string => {
  const base = `Você é um assistente de dados esportivos. Use a BUSCA DO GOOGLE para consultar dados REAIS e em tempo real da Copa do Mundo FIFA 2026. Hoje é ${now} (horário de Brasília). NUNCA invente resultados, placares, datas ou confrontos — se não tiver certeza, deixe o campo vazio/null.`;

  if (type === 'WC_BRAZIL') {
    return `${base}
Traga a participação da SELEÇÃO BRASILEIRA MASCULINA nesta Copa.
Retorne APENAS um JSON no formato:
{
  "results": [
    { "opponent": "Nome do adversário", "opponentFlag": "emoji da bandeira", "brScore": number, "advScore": number, "stage": "Fase (ex: Fase de Grupos — 1ª rodada)", "date": "DD/MM" }
  ],
  "nextMatch": { "opponent": "Nome", "opponentFlag": "emoji", "date": "DD/MM/AAAA", "time": "HH:MM", "stage": "Fase", "venue": "Estádio, Cidade" }
}
Regras: "results" em ordem cronológica, SOMENTE jogos JÁ realizados do Brasil nesta Copa (placar do Brasil em brScore, do adversário em advScore). Se o Brasil ainda não estreou, "results": []. Se não houver próximo jogo agendado (eliminado ou campeão), "nextMatch": null.`;
  }

  if (type === 'WC_TODAY') {
    return `${base}
Liste TODOS os jogos da Copa que acontecem HOJE.
Retorne APENAS um JSON no formato:
{
  "matches": [
    { "home": "Time", "homeFlag": "emoji", "away": "Time", "awayFlag": "emoji", "homeScore": number|null, "awayScore": number|null, "time": "HH:MM", "stage": "Fase", "status": "scheduled|live|finished" }
  ]
}
Regras: apenas jogos de HOJE, ordenados por horário. Placar null se ainda não começou. "status": "live" se em andamento, "finished" se encerrado, "scheduled" se ainda vai começar. Se não houver jogos hoje, "matches": [].`;
  }

  // WC_BRACKET
  return `${base}
Traga o CHAVEAMENTO (mata-mata) atual da Copa.
Retorne APENAS um JSON no formato:
{
  "rounds": [
    { "name": "Nome da fase (ex: Oitavas de Final)", "matches": [
      { "home": "Time", "homeFlag": "emoji", "away": "Time", "awayFlag": "emoji", "homeScore": number|null, "awayScore": number|null, "status": "scheduled|live|finished" }
    ] }
  ]
}
Regras: ordene "rounds" da fase mais cedo para a Final. Inclua somente fases de mata-mata JÁ definidas (com confrontos conhecidos). Se o mata-mata ainda não começou, "rounds": []. Placar null se o jogo não terminou.`;
};

// Calls Gemini with Google Search grounding and returns the parsed JSON object
// (or null). Callers persist it to Firestore. Mirrors fetchWeather's config.
export async function fetchWorldCupData(type: WCType): Promise<any | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: buildPrompt(type, now),
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
    },
  });

  if (!response.text) return null;
  return JSON.parse(response.text);
}
