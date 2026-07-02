// World Cup mode — shared data layer (single source of truth).
//
// All matches live in a single Firestore collection `wc_matches`. The three
// card types are just VIEWS over it:
//   WC_BRAZIL  — Brazil's journey (finished games) + next match
//   WC_TODAY   — today's matches
//   WC_BRACKET — the knockout bracket (grouped by stage)
//
// A finished game never changes, so it's stored as fixed base data (imported
// once). The IA is used ONLY to update/discover pending & future games — never
// to rewrite a finished result. This keeps IA usage (and error surface) small.
import { GoogleGenAI } from '@google/genai';

export type WCType = 'WC_BRAZIL' | 'WC_TODAY' | 'WC_BRACKET';
export type WCStatus = 'scheduled' | 'live' | 'finished';

export interface WCMatch {
  id?: string;
  date?: string; // ISO "2026-06-29"
  time?: string; // "17:00" (Brasília)
  stage?: string; // "Fase de Grupos", "16 avos de final", ...
  home: string;
  away: string;
  homeCode?: string; // ISO 3166-1 alpha-2 (e.g. "br"); primary flag source
  awayCode?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homePens?: number | null; // penalty shootout goals (knockout only)
  awayPens?: number | null;
  status?: WCStatus;
}

export interface WCBrazilResult {
  opponent: string;
  opponentCode?: string;
  brScore: number;
  advScore: number;
  brPens?: number | null;
  advPens?: number | null;
  stage?: string;
  date?: string;
}

export interface WCBrazilNext {
  opponent: string;
  opponentCode?: string;
  date?: string;
  time?: string;
  stage?: string;
}

export interface WCBracketRound {
  name: string;
  matches: WCMatch[];
}

// Cache window for the broad TV-side refresh of all pending matches.
export const WC_PENDING_CACHE_MS = 10 * 60 * 1000;
// A live game refreshes much faster than the broad pending sweep.
export const WC_LIVE_REFRESH_MS = 60 * 1000;
// A kicked-off match is treated as live for this long (unless marked finished).
export const WC_LIVE_WINDOW_MS = 150 * 60 * 1000; // 2h30

// --- Time / live detection (Brazil is fixed GMT-3, no DST) ------------------

// Today's date (YYYY-MM-DD) in Brasília time, regardless of the TV's timezone.
export const brasiliaTodayISO = (nowMs: number): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(nowMs));

// Kickoff instant (epoch ms) from a match's date + time, read as GMT-3.
export const kickoffMs = (m: WCMatch): number | null => {
  if (!m.date) return null;
  const time = m.time && /^\d{1,2}:\d{2}$/.test(m.time) ? m.time.padStart(5, '0') : '00:00';
  const t = Date.parse(`${m.date}T${time}:00-03:00`);
  return isNaN(t) ? null : t;
};

// A match is "live" if explicitly marked live, or if its GMT-3 kickoff has
// passed within the live window and it isn't finished yet.
export const isLiveByClock = (m: WCMatch, nowMs: number): boolean => {
  if (m.status === 'finished') return false;
  if (m.status === 'live') return true;
  const k = kickoffMs(m);
  return k != null && nowMs >= k && nowMs - k < WC_LIVE_WINDOW_MS;
};

// --- Flags ------------------------------------------------------------------

// Flag image from an ISO 3166-1 alpha-2 code. Uses flagcdn (standard country
// flag artwork). UK nations: gb-eng / gb-sct / gb-wls. Swap base if blocked.
export const flagUrl = (code?: string, size: string = 'w160'): string | null => {
  if (!code) return null;
  const c = code.trim().toLowerCase();
  return c ? `https://flagcdn.com/${size}/${c}.png` : null;
};

// --- Country name → ISO code (Portuguese names) -----------------------------

const stripAccents = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const norm = (s: string) => stripAccents((s || '').toLowerCase()).trim();

const COUNTRY_CODES: Record<string, string> = {
  'brasil': 'br', 'argentina': 'ar', 'uruguai': 'uy', 'colombia': 'co', 'chile': 'cl',
  'peru': 'pe', 'equador': 'ec', 'paraguai': 'py', 'bolivia': 'bo', 'venezuela': 've',
  'estados unidos': 'us', 'mexico': 'mx', 'canada': 'ca', 'costa rica': 'cr', 'panama': 'pa',
  'honduras': 'hn', 'jamaica': 'jm', 'franca': 'fr', 'alemanha': 'de', 'espanha': 'es',
  'portugal': 'pt', 'italia': 'it', 'holanda': 'nl', 'paises baixos': 'nl', 'belgica': 'be',
  'inglaterra': 'gb-eng', 'escocia': 'gb-sct', 'pais de gales': 'gb-wls', 'irlanda': 'ie',
  'irlanda do norte': 'gb-nir', 'suica': 'ch', 'austria': 'at', 'suecia': 'se',
  'noruega': 'no', 'dinamarca': 'dk', 'polonia': 'pl', 'croacia': 'hr', 'servia': 'rs',
  'ucrania': 'ua', 'turquia': 'tr', 'grecia': 'gr', 'republica tcheca': 'cz', 'hungria': 'hu',
  'romenia': 'ro', 'japao': 'jp', 'coreia do sul': 'kr', 'australia': 'au', 'ira': 'ir',
  'arabia saudita': 'sa', 'catar': 'qa', 'qatar': 'qa', 'iraque': 'iq', 'jordania': 'jo',
  'emirados arabes unidos': 'ae', 'uzbequistao': 'uz', 'marrocos': 'ma', 'senegal': 'sn',
  'tunisia': 'tn', 'argelia': 'dz', 'egito': 'eg', 'gana': 'gh', 'nigeria': 'ng',
  'camaroes': 'cm', 'costa do marfim': 'ci', 'africa do sul': 'za', 'mali': 'ml',
  'cabo verde': 'cv', 'republica democratica do congo': 'cd', 'congo': 'cg',
  'nova zelandia': 'nz', 'bosnia e herzegovina': 'ba', 'bosnia': 'ba',
};

export const codeForCountry = (name?: string): string | undefined => {
  if (!name) return undefined;
  return COUNTRY_CODES[norm(name)];
};

// --- Result letter (V/E/D from Brazil's view; pens decide a level game) ------

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

// --- Match identity / normalization -----------------------------------------

const slug = (s: string) =>
  norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Deterministic doc id so re-importing upserts instead of duplicating.
export const matchDocId = (m: { date?: string; home: string; away: string }) =>
  `${m.date || 'sd'}__${slug(m.home)}__${slug(m.away)}`;

const normalizeStatus = (raw: any): WCStatus => {
  const s = norm(String(raw || ''));
  if (!s) return 'scheduled';
  if (s.includes('encerr') || s.includes('final') || s.includes('finish')) return 'finished';
  if (s.includes('andamento') || s.includes('live') || s.includes('vivo')) return 'live';
  return 'scheduled';
};

const extractTime = (raw: any): string => {
  const m = String(raw || '').match(/(\d{1,2}:\d{2})/);
  return m ? m[1] : '';
};

const numOrNull = (v: any): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

export const isBrazil = (name?: string) => norm(name || '') === 'brasil';
export const isKnockoutStage = (stage?: string) => !!stage && !norm(stage).includes('grupo');

// Order of knockout rounds for the bracket columns.
export const knockoutOrder = (stage?: string): number => {
  const s = norm(stage || '');
  if (s.includes('16 avos') || s.includes('32 avos') || s.includes('dezesseis')) return 1;
  if (s.includes('oitavas')) return 2;
  if (s.includes('quartas')) return 3;
  if (s.includes('semi')) return 4;
  if (s.includes('3') || s.includes('terceiro') || s.includes('disputa')) return 5;
  if (s.includes('final')) return 6;
  return 99;
};

// --- Import parser (accepts the "copa_do_mundo.jogos_recentes" shape) --------

// Fixes the paste corruptions that most often break JSON.parse: smart/curly
// quotes, non-breaking spaces, and trailing commas before } or ].
const sanitizeJson = (s: string): string =>
  s
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // smart double quotes
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")         // smart single quotes
    .replace(/[\u00A0\u2007\u202F\u2000-\u200A]/g, ' ')        // non-breaking / thin spaces
    .replace(/,\s*([}\]])/g, '$1');                               // trailing commas

// Tolerant JSON parse. Grounded IA output wraps JSON in fences/prose, and
// pasted JSON often carries smart quotes / trailing commas — handle both.
export function parseLooseJson(text: string): any | null {
  if (!text) return null;
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const tryParse = (str: string): any | undefined => {
    try { return JSON.parse(str); } catch { return undefined; }
  };

  for (const candidate of [s, sanitizeJson(s)]) {
    const direct = tryParse(candidate);
    if (direct !== undefined) return direct;
    // extract the outermost {...} or [...] block and retry
    for (const [open, close] of [['{', '}'], ['[', ']']]) {
      const f = candidate.indexOf(open);
      const l = candidate.lastIndexOf(close);
      if (f !== -1 && l > f) {
        const r = tryParse(candidate.slice(f, l + 1));
        if (r !== undefined) return r;
      }
    }
  }
  return null;
}

// Turn one raw item (PT-labelled or our own shape) into a normalized WCMatch.
export function normalizeMatchItem(item: any): WCMatch | null {
  if (!item) return null;
  const home = item.home ?? item.equipe_casa ?? item.mandante;
  const away = item.away ?? item.equipe_visitante ?? item.visitante;
  if (!home || !away) return null;
  const date = item.date ?? item.data ?? '';
  const stage = item.stage ?? item.fase ?? '';
  return {
    date,
    stage,
    time: item.time ?? extractTime(item.status) ?? '',
    home: String(home),
    away: String(away),
    homeCode: item.homeCode ?? item.codigo_casa ?? codeForCountry(String(home)),
    awayCode: item.awayCode ?? item.codigo_visitante ?? codeForCountry(String(away)),
    homeScore: numOrNull(item.homeScore ?? item.placar_casa),
    awayScore: numOrNull(item.awayScore ?? item.placar_visitante),
    homePens: numOrNull(item.homePens ?? item.penaltis_casa),
    awayPens: numOrNull(item.awayPens ?? item.penaltis_visitante),
    status: normalizeStatus(item.status),
    id: matchDocId({ date, home: String(home), away: String(away) }),
  };
}

const looksLikeMatch = (o: any) => o && typeof o === 'object' && (o.equipe_casa || o.home || o.mandante);

// Finds the array of matches in an object regardless of the key name used
// (todos_os_jogos, jogos_recentes, fase_mata_mata, matches, jogos, ...).
const findMatchArray = (obj: any): any[] | null => {
  if (!obj || typeof obj !== 'object') return null;
  const known = ['todos_os_jogos', 'jogos_recentes', 'fase_mata_mata', 'jogos', 'matches', 'games', 'partidas'];
  for (const k of known) if (Array.isArray(obj[k]) && obj[k].some(looksLikeMatch)) return obj[k];
  // generic fallback: first array whose items look like matches
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) && v.some(looksLikeMatch)) return v as any[];
  }
  return null;
};

// Parse a pasted base dump into normalized matches (idempotent ids). Accepts
// a top-level array, or an object with the match array under any key (also
// nested under `copa_do_mundo`).
export function parseBaseImport(text: string): WCMatch[] {
  const data = parseLooseJson(text);
  if (!data) return [];
  const list = Array.isArray(data)
    ? data
    : (findMatchArray(data?.copa_do_mundo) || findMatchArray(data) || []);
  return (Array.isArray(list) ? list : [])
    .map(normalizeMatchItem)
    .filter((m): m is WCMatch => !!m);
}

// --- Views over the match set -----------------------------------------------

const byDateAsc = (a: WCMatch, b: WCMatch) =>
  `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`);

// Two imports with different name spellings for the same fixture (e.g.
// "Congo DR" vs "República Democrática do Congo") create separate docs.
// Collapse them by date + country codes (falling back to normalized names),
// keeping the most complete record (finished/scored wins).
const matchKey = (m: WCMatch) =>
  `${m.date || ''}|${(m.homeCode || norm(m.home)).toLowerCase()}|${(m.awayCode || norm(m.away)).toLowerCase()}`;

const matchRank = (m: WCMatch) =>
  (m.status === 'finished' ? 100 : m.status === 'live' ? 50 : 0) +
  (m.homeScore != null && m.awayScore != null ? 10 : 0);

export const dedupeMatches = (matches: WCMatch[]): WCMatch[] => {
  const best = new Map<string, WCMatch>();
  for (const m of matches) {
    const k = matchKey(m);
    const prev = best.get(k);
    if (!prev || matchRank(m) > matchRank(prev)) best.set(k, m);
  }
  return Array.from(best.values());
};

export function deriveBrazil(matches: WCMatch[]): { results: WCBrazilResult[]; nextMatch: WCBrazilNext | null } {
  const br = dedupeMatches(matches).filter(m => isBrazil(m.home) || isBrazil(m.away)).sort(byDateAsc);
  const results: WCBrazilResult[] = br
    .filter(m => m.status === 'finished')
    .map(m => {
      const brHome = isBrazil(m.home);
      return {
        opponent: brHome ? m.away : m.home,
        opponentCode: brHome ? m.awayCode : m.homeCode,
        brScore: Number(brHome ? m.homeScore : m.awayScore) || 0,
        advScore: Number(brHome ? m.awayScore : m.homeScore) || 0,
        brPens: brHome ? m.homePens : m.awayPens,
        advPens: brHome ? m.awayPens : m.homePens,
        stage: m.stage,
        date: m.date,
      };
    });
  const nx = br.find(m => m.status !== 'finished');
  let nextMatch: WCBrazilNext | null = null;
  if (nx) {
    const brHome = isBrazil(nx.home);
    nextMatch = {
      opponent: brHome ? nx.away : nx.home,
      opponentCode: brHome ? nx.awayCode : nx.homeCode,
      date: nx.date,
      time: nx.time,
      stage: nx.stage,
    };
  }
  return { results, nextMatch };
}

export function deriveToday(matches: WCMatch[], todayISO: string): WCMatch[] {
  return dedupeMatches(matches).filter(m => m.date === todayISO).sort(byDateAsc);
}

export function deriveBracket(matches: WCMatch[]): WCBracketRound[] {
  const ko = dedupeMatches(matches).filter(m => isKnockoutStage(m.stage));
  const byStage: Record<string, WCMatch[]> = {};
  ko.forEach(m => {
    const key = m.stage || 'Mata-mata';
    (byStage[key] = byStage[key] || []).push(m);
  });
  return Object.keys(byStage)
    .sort((a, b) => knockoutOrder(a) - knockoutOrder(b))
    .map(name => ({ name, matches: byStage[name].sort(byDateAsc) }));
}

// --- IA: update ONLY pending/future games (never rewrite finished) ----------

// Asks Gemini (Google Search) for the current score/status of the pending
// games plus any newly-defined upcoming fixtures. Returns normalized matches;
// the caller upserts non-finished docs and adds new ones, never touching a
// doc that is already finished.
export async function fetchWcPendingUpdates(pending: WCMatch[]): Promise<WCMatch[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const list = pending
    .map(m => `- ${m.home} x ${m.away}${m.date ? ` (${m.date})` : ''} [${m.stage || ''}]`)
    .join('\n');

  const prompt = `Você é um assistente de dados esportivos. Use a BUSCA DO GOOGLE para consultar dados REAIS e em tempo real da Copa do Mundo FIFA 2026. Hoje é ${now} (horário de Brasília). NUNCA invente placares — se não tiver certeza, use null e status "scheduled".
Preciso de:
1) o estado atual destes jogos pendentes:
${list || '(sem jogos pendentes conhecidos)'}
2) TODOS os próximos confrontos JÁ definidos das próximas fases do mata-mata (ex: oitavas de final), MESMO que ainda não tenham data/horário — inclua obrigatoriamente o PRÓXIMO JOGO DA SELEÇÃO BRASILEIRA se já estiver definido (adversário conhecido). Para jogos ainda não realizados use placar null e status "scheduled".
NÃO inclua jogos já encerrados de dias anteriores.
Para cada seleção informe o código ISO 3166-1 alpha-2 do país em minúsculas (ex: Brasil="br", Japão="jp", Inglaterra="gb-eng").
Retorne APENAS um JSON:
{ "matches": [ { "home": "Time", "homeCode": "iso", "away": "Time", "awayCode": "iso", "date": "AAAA-MM-DD", "time": "HH:MM", "stage": "Fase", "homeScore": number|null, "awayScore": number|null, "homePens": number|null, "awayPens": number|null, "status": "scheduled|live|finished" } ] }`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  const data = parseLooseJson(response.text || '');
  const arr = data?.matches ?? (Array.isArray(data) ? data : []);
  return (Array.isArray(arr) ? arr : [])
    .map(normalizeMatchItem)
    .filter((m): m is WCMatch => !!m);
}
