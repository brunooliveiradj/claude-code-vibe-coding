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
  homeCode?: string; // ISO 3166-1 alpha-2 (e.g. "br"); primary flag source
  awayCode?: string;
  homeFlag?: string; // emoji fallback
  awayFlag?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homePens?: number | null; // penalty shootout goals (knockout only)
  awayPens?: number | null;
  date?: string;
  time?: string;
  stage?: string;
  status?: 'scheduled' | 'live' | 'finished';
}

export interface WCBrazilResult {
  opponent: string;
  opponentCode?: string;
  opponentFlag?: string;
  brScore: number;
  advScore: number;
  brPens?: number | null; // penalty shootout goals (knockout only)
  advPens?: number | null;
  stage?: string;
  date?: string;
}

export interface WCBrazilNext {
  opponent: string;
  opponentCode?: string;
  opponentFlag?: string;
  date?: string;
  time?: string;
  stage?: string;
  venue?: string;
}

// Build a flag image URL from an ISO 3166-1 alpha-2 country code. Uses flagcdn
// (standard country flag artwork, same source family as Wikipedia). UK nations
// use codes like "gb-eng" / "gb-sct" / "gb-wls". Swap this base if ever blocked.
export const flagUrl = (code?: string): string | null => {
  if (!code) return null;
  const c = code.trim().toLowerCase();
  if (!c) return null;
  return `https://flagcdn.com/w160/${c}.png`;
};

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
// When regulation ends level and there was a shootout, the pens decide it.
export const wcResultLetter = (
  brScore: number,
  advScore: number,
  brPens?: number | null,
  advPens?: number | null
): 'V' | 'E' | 'D' => {
  if (brScore > advScore) return 'V';
  if (brScore < advScore) return 'D';
  if (brPens != null && advPens != null) {
    if (brPens > advPens) return 'V';
    if (brPens < advPens) return 'D';
  }
  return 'E';
};

const buildPrompt = (type: WCType, now: string): string => {
  const base = `Você é um assistente de dados esportivos. Use a BUSCA DO GOOGLE para consultar dados REAIS e em tempo real da Copa do Mundo FIFA 2026. Hoje é ${now} (horário de Brasília). NUNCA invente resultados, placares, datas ou confrontos — se não tiver certeza, deixe o campo vazio/null. Para CADA seleção, informe o código ISO 3166-1 alpha-2 do país em minúsculas (ex: Brasil="br", Japão="jp", Alemanha="de", Argentina="ar", EUA="us"). Para as seleções do Reino Unido use: Inglaterra="gb-eng", Escócia="gb-sct", País de Gales="gb-wls", Irlanda do Norte="gb-nir".`;

  if (type === 'WC_BRAZIL') {
    return `${base}
Traga a participação da SELEÇÃO BRASILEIRA MASCULINA nesta Copa.
Retorne APENAS um JSON no formato:
{
  "results": [
    { "opponent": "Nome do adversário", "opponentCode": "código ISO", "opponentFlag": "emoji da bandeira", "brScore": number, "advScore": number, "brPens": number|null, "advPens": number|null, "stage": "Fase (ex: Fase de Grupos — 1ª rodada)", "date": "DD/MM" }
  ],
  "nextMatch": { "opponent": "Nome", "opponentCode": "código ISO", "opponentFlag": "emoji", "date": "DD/MM/AAAA", "time": "HH:MM", "stage": "Fase", "venue": "Estádio, Cidade" }
}
Regras: "results" em ordem cronológica, SOMENTE jogos JÁ realizados do Brasil nesta Copa (placar do Brasil em brScore, do adversário em advScore). Se o jogo foi decidido nos pênaltis, preencha brPens/advPens (gols na disputa); senão null. Se o Brasil ainda não estreou, "results": []. Se não houver próximo jogo agendado (eliminado ou campeão), "nextMatch": null.`;
  }

  if (type === 'WC_TODAY') {
    return `${base}
Liste TODOS os jogos da Copa que acontecem HOJE.
Retorne APENAS um JSON no formato:
{
  "matches": [
    { "home": "Time", "homeCode": "código ISO", "homeFlag": "emoji", "away": "Time", "awayCode": "código ISO", "awayFlag": "emoji", "homeScore": number|null, "awayScore": number|null, "homePens": number|null, "awayPens": number|null, "time": "HH:MM", "stage": "Fase", "status": "scheduled|live|finished" }
  ]
}
Regras: apenas jogos de HOJE, ordenados por horário. Placar null se ainda não começou. Se foi decidido nos pênaltis, preencha homePens/awayPens; senão null. "status": "live" se em andamento, "finished" se encerrado, "scheduled" se ainda vai começar. Se não houver jogos hoje, "matches": [].`;
  }

  // WC_BRACKET
  return `${base}
Traga o CHAVEAMENTO (mata-mata) atual da Copa.
Retorne APENAS um JSON no formato:
{
  "rounds": [
    { "name": "Nome da fase (ex: 16 avos de final)", "matches": [
      { "home": "Time", "homeCode": "código ISO", "homeFlag": "emoji", "away": "Time", "awayCode": "código ISO", "awayFlag": "emoji", "homeScore": number|null, "awayScore": number|null, "homePens": number|null, "awayPens": number|null, "status": "scheduled|live|finished" }
    ] }
  ]
}
Regras: ordene "rounds" da fase mais cedo para a Final. Inclua somente fases de mata-mata JÁ definidas (com confrontos conhecidos). Se o mata-mata ainda não começou, "rounds": []. Placar null se o jogo não terminou. Se foi decidido nos pênaltis, preencha homePens/awayPens (gols na disputa); senão null.`;
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
