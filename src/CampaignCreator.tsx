import { useState, useEffect, useRef } from "react";
import { Sparkles, Globe, ArrowRight, ArrowLeft, Check, AlertTriangle, Lightbulb, ChevronRight, Rocket } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Goal = "AWARENESS" | "ENGAGEMENT" | "VENDAS" | "MISTO";
type BidType = "CPM" | "CPC" | "CPV";
type MediaType = "DISPLAY" | "VIDEO";
type Screen = "landing" | "briefing" | "wizard" | "success";

interface Form {
  advertiserId: string; advertiserName: string; goal: Goal | "";
  name: string; startDate: string; endDate: string;
  budget: string; pacing: "daily" | "total"; freqCap: string;
  groupName: string; bidType: BidType; bidValue: string;
  mediaType: MediaType; geoStates: string[];
  broadAudiences: string[]; segmentedAudiences: string[];
  creativeIds: string[]; pixelIds: string[]; skipPixel: boolean;
}

interface PlaybookRec { icon: string; text: string; }

interface StrategicInsight { icon: string; title: string; text: string; }

interface BriefingAnalysis {
  businessDescription: string; businessType: string;
  businessLabel: string; businessIcon: string;
  goal: Goal; goalConfidence: "detectado" | "sugerido";
  budget: string; budgetConfidence: "detectado" | "sugerido" | "nao_informado";
  startDate: string; endDate: string; periodLabel: string; periodAlert: string;
  strategicInsights: StrategicInsight[];
  opportunities: string[];
  playbookRecs: PlaybookRec[];
  wizardDefaults: Partial<Form>;
}

// ── Static data ───────────────────────────────────────────────────────────────

const ADVERTISERS = [
  { id: "adv-1", name: "Renner" }, { id: "adv-2", name: "iFood" },
  { id: "adv-3", name: "Magazine Luiza" }, { id: "adv-4", name: "Banco Inter" },
];
const STATES = [
  { id: "sp", label: "São Paulo (SP)" }, { id: "rj", label: "Rio de Janeiro (RJ)" },
  { id: "mg", label: "Minas Gerais (MG)" }, { id: "rs", label: "Rio Grande do Sul (RS)" },
  { id: "pr", label: "Paraná (PR)" }, { id: "sc", label: "Santa Catarina (SC)" },
];
const BROAD_AUD = [
  { id: "ba-1", label: "Todos os usuários" }, { id: "ba-2", label: "Jovens adultos (18–34)" },
  { id: "ba-3", label: "Adultos (35–54)" }, { id: "ba-4", label: "Alta renda" },
  { id: "ba-5", label: "Classe média" }, { id: "ba-6", label: "Interessados em moda" },
];
const SEG_AUD = [
  { id: "sa-1", label: "Retargeting de visitantes" }, { id: "sa-2", label: "Lookalike de clientes" },
  { id: "sa-3", label: "Abandono de carrinho" }, { id: "sa-4", label: "Compradores recentes" },
  { id: "sa-5", label: "Clientes VIP" },
];
const CREATIVES = [
  { id: "cr-1", name: "Banner Principal", type: "Display", size: "300×250", icon: "🖼️" },
  { id: "cr-2", name: "Leaderboard", type: "Display", size: "728×90", icon: "🖼️" },
  { id: "cr-3", name: "Vídeo 15s", type: "Video", size: "1920×1080", icon: "🎬" },
  { id: "cr-4", name: "Vídeo 30s", type: "Video", size: "1920×1080", icon: "🎬" },
];
const PIXELS = [
  { id: "px-1", name: "Pixel de Conversão", type: "conversion", icon: "🎯" },
  { id: "px-2", name: "Pixel de Retargeting", type: "retargeting", icon: "🔄" },
];
const GOAL_OPTIONS = [
  { id: "AWARENESS" as Goal, label: "Reconhecimento", desc: "Ampliar visibilidade da marca", icon: "📢" },
  { id: "ENGAGEMENT" as Goal, label: "Engajamento", desc: "Interações e cliques qualificados", icon: "💬" },
  { id: "VENDAS" as Goal, label: "Conversão", desc: "Vendas e ações diretas", icon: "🛒" },
  { id: "MISTO" as Goal, label: "Misto", desc: "Combinar múltiplos objetivos", icon: "🎯" },
];
const WIZARD_STEPS = [
  { id: 1, title: "Objetivo" }, { id: 2, title: "Configurações" }, { id: 3, title: "Lances" },
  { id: 4, title: "Público & Geo" }, { id: 5, title: "Criativos" }, { id: 6, title: "Pixel" }, { id: 7, title: "Revisão" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const tog = <T,>(arr: T[], v: T): T[] => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
const fmt$ = (v: string | number) => {
  const n = parseFloat(String(v).replace(",", ".")) || 0;
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
};
const fmtDate = (d: string) => { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const fmtNum = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n);
const daysBetween = (a: string, b: string) => { const ms = new Date(b).getTime() - new Date(a).getTime(); return ms > 0 ? Math.ceil(ms / 86400000) : 0; };
const addDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split("T")[0];

const estimateImp = (form: Form) => {
  const budget = parseFloat(form.budget) || 0;
  const bid = parseFloat(form.bidValue) || 12;
  if (!budget || !bid) return null;
  const days = daysBetween(form.startDate, form.endDate) || 30;
  const cpm = form.bidType === "CPM" ? bid : 12;
  const imps = Math.round((budget / cpm) * 1000);
  return { imps, days, daily: Math.round(imps / days) };
};

const defaultForm: Form = {
  advertiserId: "", advertiserName: "", goal: "", name: "",
  startDate: "", endDate: "", budget: "", pacing: "daily", freqCap: "3",
  groupName: "Grupo Principal", bidType: "CPM", bidValue: "",
  mediaType: "DISPLAY", geoStates: [], broadAudiences: [], segmentedAudiences: [],
  creativeIds: [], pixelIds: [], skipPixel: false,
};

const canConfirm = (step: number, form: Form) => {
  switch (step) {
    case 1: return !!form.advertiserId && !!form.goal;
    case 2: return !!form.name && !!form.startDate && !!form.endDate && !!form.budget;
    case 3: return !!form.groupName && !!form.bidValue;
    case 4: return form.geoStates.length > 0 || form.broadAudiences.length > 0;
    case 5: return form.creativeIds.length > 0;
    case 6: return form.pixelIds.length > 0 || form.skipPixel;
    case 7: return true;
    default: return false;
  }
};

const getSummary = (step: number, form: Form) => {
  switch (step) {
    case 1: { const adv = ADVERTISERS.find(a => a.id === form.advertiserId); const g = GOAL_OPTIONS.find(g => g.id === form.goal); return `${adv?.name || "—"} · ${g?.label || "—"}`; }
    case 2: return `${form.name || "—"} · ${fmtDate(form.startDate)} – ${fmtDate(form.endDate)} · ${form.budget ? fmt$(form.budget) : "—"}`;
    case 3: return `${form.bidType} ${form.bidValue ? fmt$(form.bidValue) : "—"} · ${form.groupName || "—"}`;
    case 4: { const ss = form.geoStates.map(id => STATES.find(s => s.id === id)?.label.match(/\((\w+)\)/)?.[1]).filter(Boolean); const ba = form.broadAudiences.map(id => BROAD_AUD.find(a => a.id === id)?.label).filter(Boolean); return `${form.mediaType} · ${ss.join(", ") || "—"} · ${ba.slice(0, 2).join(", ") || "—"}`; }
    case 5: return form.creativeIds.map(id => CREATIVES.find(c => c.id === id)?.name).filter(Boolean).join(", ") || "—";
    case 6: return form.skipPixel ? "Sem rastreamento" : form.pixelIds.map(id => PIXELS.find(p => p.id === id)?.name).filter(Boolean).join(", ") || "—";
    default: return "";
  }
};

// ── AI integration ─────────────────────────────────────────────────────────────

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const SYSTEM_PROMPT = `Você é um planejador de mídia programática sênior da Pixel Roads, agência brasileira especializada em mídia programática.

Analise o briefing e pense ALÉM do que foi dito. Adicione insights estratégicos que o cliente pode não ter considerado, identifique oportunidades e sinalize riscos.

Retorne APENAS JSON válido (sem markdown, sem blocos de código, só JSON puro):
{
  "businessDescription": "2-3 frases sobre o negócio",
  "businessType": "moda|food|financeiro|app|ecommerce|saude|turismo|educacao|generico",
  "businessLabel": "Moda & Varejo",
  "businessIcon": "👗",
  "goal": "AWARENESS|ENGAGEMENT|VENDAS|MISTO",
  "goalConfidence": "detectado|sugerido",
  "budget": "30000",
  "budgetConfidence": "detectado|sugerido|nao_informado",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "periodLabel": "descrição curta",
  "periodAlert": "aviso importante sobre o período ou string vazia",
  "strategicInsights": [
    {"icon": "💡", "title": "Título", "text": "Insight estratégico que vai ALÉM do briefing — algo que o cliente não percebeu"}
  ],
  "opportunities": ["Oportunidade 1 não mencionada", "Oportunidade 2"],
  "playbookRecs": [
    {"icon": "🎯", "text": "Recomendação com <strong>destaque</strong> quando necessário"}
  ],
  "wizardDefaults": {
    "mediaType": "DISPLAY|VIDEO",
    "bidType": "CPM|CPC|CPV",
    "bidValue": "14.50",
    "geoStates": ["sp","rj"],
    "broadAudiences": ["ba-1"],
    "segmentedAudiences": ["sa-1"],
    "creativeIds": ["cr-1"],
    "pixelIds": ["px-1"],
    "freqCap": "3"
  }
}

IDs válidos — use exatamente estes:
geoStates: sp, rj, mg, rs, pr, sc
broadAudiences: ba-1(todos), ba-2(jovens 18-34), ba-3(adultos 35-54), ba-4(alta renda), ba-5(classe média), ba-6(moda)
segmentedAudiences: sa-1(retargeting), sa-2(lookalike), sa-3(abandono carrinho), sa-4(compradores recentes), sa-5(VIP)
creativeIds: cr-1(banner 300x250), cr-2(leaderboard), cr-3(vídeo 15s), cr-4(vídeo 30s)
pixelIds: px-1(conversão), px-2(retargeting)

Para datas: use o ano atual. Se não especificado, sugira 30 dias a partir de hoje.`;

async function callGemini(briefing: string, websiteContent?: string): Promise<BriefingAnalysis> {
  const prompt = `${SYSTEM_PROMPT}${websiteContent ? `\n\nConteúdo do site do cliente:\n${websiteContent.slice(0, 3000)}\n\n` : "\n\n"}Briefing: "${briefing}"`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON");
  return JSON.parse(match[0]) as BriefingAnalysis;
}

async function readUrl(url: string): Promise<string> {
  const clean = url.startsWith("http") ? url : `https://${url}`;
  const res = await fetch(`https://r.jina.ai/${clean}`, { headers: { Accept: "text/plain" } });
  if (!res.ok) throw new Error(`URL read failed: ${res.status}`);
  return (await res.text()).slice(0, 4000);
}

function fallbackParse(text: string): BriefingAnalysis {
  const lo = text.toLowerCase();
  let goal: Goal = "AWARENESS", goalConf: "detectado" | "sugerido" = "sugerido";
  if (/vend|compra|convers|pedido|checkout|receita/.test(lo)) { goal = "VENDAS"; goalConf = "detectado"; }
  else if (/engaj|clique|interact/.test(lo)) { goal = "ENGAGEMENT"; goalConf = "detectado"; }
  let budget = "";
  const bm = text.match(/R\$\s*([\d.,]+)\s*(mil|k)?|([\d]+)\s*(mil|k|reais)/i);
  if (bm) { let v = parseFloat((bm[1] || bm[3] || "").replace(",", ".")); if (/mil|k/i.test(bm[2] || bm[4] || "")) v *= 1000; if (v > 0) budget = String(v); }
  const yr = new Date().getFullYear();
  let startDate = addDays(5), endDate = addDays(35), periodLabel = "30 dias (sugerido)", periodAlert = "";
  if (/natal|dezembro/.test(lo)) { startDate = `${yr}-11-25`; endDate = `${yr}-12-25`; periodLabel = "Natal"; }
  if (/black friday/.test(lo)) { startDate = `${yr}-11-14`; endDate = `${yr}-11-30`; periodAlert = "⚠️ CPM sobe 35–40% durante Black Friday. Recomendo lances 20% acima do normal."; periodLabel = "Black Friday"; }
  let bType = "generico", bLabel = "Produto/Serviço", bIcon = "🏪";
  if (/roupa|moda|fashion/.test(lo)) { bType = "moda"; bLabel = "Moda & Varejo"; bIcon = "👗"; }
  else if (/comida|food|delivery/.test(lo)) { bType = "food"; bLabel = "Food & Delivery"; bIcon = "🍔"; }
  else if (/banco|financ|crédito/.test(lo)) { bType = "financeiro"; bLabel = "Financeiro"; bIcon = "🏦"; }
  else if (/app|aplicat/.test(lo)) { bType = "app"; bLabel = "App Mobile"; bIcon = "📱"; }
  const playbookMap: Record<string, { recs: PlaybookRec[]; defaults: Partial<Form> }> = {
    moda: { recs: [{ icon: "🎯", text: "Display + Retargeting dinâmico converte <strong>3× mais</strong> para moda" }, { icon: "👥", text: "Alta renda + Abandono de carrinho — audiências de maior performance" }, { icon: "🗺️", text: "SP, RJ, MG — respondem por ~60% do e-commerce de moda" }], defaults: { mediaType: "DISPLAY", bidType: "CPM", bidValue: "20", geoStates: ["sp", "rj", "mg"], broadAudiences: ["ba-4", "ba-6"], segmentedAudiences: ["sa-3", "sa-2"], creativeIds: ["cr-1", "cr-3"], pixelIds: ["px-1"] } },
    food: { recs: [{ icon: "🎬", text: "Vídeo 15s gera <strong>40% mais pedidos</strong> vs Display para delivery" }, { icon: "👥", text: "Jovens adultos (18–34) respondem por 70% dos pedidos de delivery" }], defaults: { mediaType: "VIDEO", bidType: "CPV", bidValue: "0.90", geoStates: ["sp", "rj"], broadAudiences: ["ba-2"], segmentedAudiences: ["sa-1"], creativeIds: ["cr-3"], pixelIds: ["px-1"] } },
    financeiro: { recs: [{ icon: "🛡️", text: "Display brand-safe é obrigatório para serviços financeiros" }, { icon: "👥", text: "Alta renda + Adultos 35–54 — maior propensão a produtos financeiros" }], defaults: { mediaType: "DISPLAY", bidType: "CPM", bidValue: "16", geoStates: ["sp", "rj"], broadAudiences: ["ba-4", "ba-3"], segmentedAudiences: ["sa-2"], creativeIds: ["cr-1", "cr-2"], freqCap: "2", pixelIds: ["px-2"] } },
    generico: { recs: [{ icon: "🖼️", text: "Display é o formato mais versátil para começar" }, { icon: "🗺️", text: "SP + RJ cobrem 35% da população e ~60% do PIB" }, { icon: "📡", text: "Pixel ativo desde o início maximiza retorno a partir do dia 7" }], defaults: { mediaType: "DISPLAY", bidType: "CPM", bidValue: "14", geoStates: ["sp", "rj"], broadAudiences: ["ba-1"], segmentedAudiences: ["sa-1"], creativeIds: ["cr-1"], pixelIds: ["px-1"] } },
  };
  const pb = playbookMap[bType] || playbookMap.generico;
  return { businessDescription: text.slice(0, 100) + "…", businessType: bType, businessLabel: bLabel, businessIcon: bIcon, goal, goalConfidence: goalConf, budget, budgetConfidence: budget ? "detectado" : "nao_informado", startDate, endDate, periodLabel, periodAlert, strategicInsights: [], opportunities: [], playbookRecs: pb.recs, wizardDefaults: { ...pb.defaults, goal } };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfBadge({ conf }: { conf: string }) {
  if (conf === "detectado") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><Check size={9} />detectado</span>;
  if (conf === "sugerido") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200"><Sparkles size={9} />sugerido</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-400 text-[10px]">não informado</span>;
}

function AiAvatar() {
  return (
    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-black"
      style={{ background: "var(--ai-grad)", boxShadow: "0 0 0 2px #fff, 0 0 0 3px rgba(185,94,240,.3)" }}>
      PR
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-2 items-center">
      <AiAvatar />
      <div className="flex gap-1 px-4 py-3 rounded-tl-sm rounded-br-2xl rounded-bl-2xl rounded-tr-2xl bg-zinc-50 border border-zinc-200">
        {[0, 200, 400].map(d => (
          <span key={d} className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  );
}

function Chip({ label, selected, onClick, highlight = false }: { label: string; selected: boolean; onClick: () => void; highlight?: boolean }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selected ? "bg-yellow-400 text-black border-yellow-400" : highlight ? "border-purple-300 text-purple-700 bg-purple-50 hover:border-yellow-400 hover:bg-yellow-50" : "border-zinc-200 text-zinc-600 bg-white hover:border-yellow-400"}`}>
      {label}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-zinc-400">{hint}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-900 outline-none focus:border-yellow-400 w-full transition-colors ${props.className || ""}`} />;
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-900 outline-none focus:border-yellow-400 w-full">
      {children}
    </select>
  );
}

// ── Step 1: Objetivo ──────────────────────────────────────────────────────────

function StepObjetivo({ form, setForm }: { form: Form; setForm: React.Dispatch<React.SetStateAction<Form>> }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Anunciante">
        <Select value={form.advertiserId} onChange={v => { const adv = ADVERTISERS.find(a => a.id === v); setForm(f => ({ ...f, advertiserId: v, advertiserName: adv?.name || "" })); }}>
          <option value="">Selecione…</option>
          {ADVERTISERS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      <Field label="Objetivo principal">
        <div className="grid grid-cols-2 gap-2">
          {GOAL_OPTIONS.map(g => (
            <button key={g.id} onClick={() => setForm(f => ({ ...f, goal: g.id }))}
              className={`p-3 rounded-xl border-2 text-left transition-all ${form.goal === g.id ? "border-yellow-400 bg-yellow-50" : "border-zinc-200 hover:border-yellow-300"}`}>
              <div className="text-xl mb-1">{g.icon}</div>
              <div className="text-xs font-semibold">{g.label}</div>
              <div className="text-[10px] text-zinc-400 mt-0.5">{g.desc}</div>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

// ── Step 2: Configurações ─────────────────────────────────────────────────────

function StepConfig({ form, setForm }: { form: Form; setForm: React.Dispatch<React.SetStateAction<Form>> }) {
  const adv = ADVERTISERS.find(a => a.id === form.advertiserId);
  const g = GOAL_OPTIONS.find(x => x.id === form.goal);
  const suggestName = () => { if (adv && g) { const m = new Date().toLocaleString("pt-BR", { month: "short" }).replace(".", ""); const yr = new Date().getFullYear(); setForm(f => ({ ...f, name: `${adv.name} ${g.label} ${m.charAt(0).toUpperCase() + m.slice(1)}/${yr}` })); } };
  const est = estimateImp(form);
  return (
    <div className="flex flex-col gap-3">
      <Field label="Nome da campanha">
        <div className="relative">
          <Input placeholder="Ex: Renner Conversão Nov/2025" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          {!form.name && adv && g && <button onClick={suggestName} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-purple-600 font-medium flex items-center gap-1 hover:text-purple-800"><Sparkles size={10} />Sugerir</button>}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início"><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></Field>
        <Field label="Término"><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></Field>
      </div>
      <Field label="Orçamento total (R$)" hint={est ? `≈ ${fmtNum(est.imps)} impressões · ${fmtNum(est.daily)}/dia por ${est.days} dias` : undefined}>
        <Input placeholder="Ex: 30000" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
      </Field>
      <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-xs font-medium">
        {(["daily", "total"] as const).map(p => (
          <button key={p} onClick={() => setForm(f => ({ ...f, pacing: p }))}
            className={`flex-1 py-2 transition-colors ${form.pacing === p ? "bg-yellow-400 text-black" : "bg-white text-zinc-400 hover:bg-zinc-50"}`}>
            {p === "daily" ? "Distribuição diária" : "Orçamento total"}
          </button>
        ))}
      </div>
      <Field label="Cap de frequência (impressões / usuário / dia)" hint="3–5 é ideal · acima de 7 o público satura">
        <Input type="number" min="1" max="20" value={form.freqCap} onChange={e => setForm(f => ({ ...f, freqCap: e.target.value }))} />
      </Field>
    </div>
  );
}

// ── Step 3: Lances ────────────────────────────────────────────────────────────

function StepGrupo({ form, setForm }: { form: Form; setForm: React.Dispatch<React.SetStateAction<Form>> }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome do grupo"><Input value={form.groupName} onChange={e => setForm(f => ({ ...f, groupName: e.target.value }))} /></Field>
      <Field label="Estratégia de compra">
        <div className="flex gap-2">
          {(["CPM", "CPC", "CPV"] as BidType[]).map(bt => (
            <Chip key={bt} label={bt} selected={form.bidType === bt} onClick={() => setForm(f => ({ ...f, bidType: bt }))} />
          ))}
        </div>
      </Field>
      <Field label={`Lance (R$ por ${form.bidType === "CPM" ? "mil impressões" : form.bidType === "CPC" ? "clique" : "view completo"})`}
        hint="Valor pré-preenchido pelo playbook — ajuste conforme disponibilidade de verba">
        <Input value={form.bidValue} onChange={e => setForm(f => ({ ...f, bidValue: e.target.value }))} />
      </Field>
    </div>
  );
}

// ── Step 4: Público & Geo ─────────────────────────────────────────────────────

function StepPublico({ form, setForm }: { form: Form; setForm: React.Dispatch<React.SetStateAction<Form>> }) {
  const reach = form.geoStates.length > 0 ? fmtNum(form.geoStates.length * 14) + "M usuários únicos" : "";
  return (
    <div className="flex flex-col gap-4">
      <Field label="Formato de mídia">
        <div className="flex gap-2">
          {(["DISPLAY", "VIDEO"] as MediaType[]).map(mt => (
            <Chip key={mt} label={mt === "DISPLAY" ? "🖼️ Display" : "🎬 Vídeo"} selected={form.mediaType === mt} onClick={() => setForm(f => ({ ...f, mediaType: mt }))} />
          ))}
        </div>
      </Field>
      <Field label={`Estados${reach ? ` · ~${reach}` : ""}`}>
        <div className="flex flex-wrap gap-2">
          {STATES.map(s => <Chip key={s.id} label={s.label} selected={form.geoStates.includes(s.id)} onClick={() => setForm(f => ({ ...f, geoStates: tog(f.geoStates, s.id) }))} />)}
        </div>
      </Field>
      <Field label="Audiências amplas">
        <div className="flex flex-wrap gap-2">
          {BROAD_AUD.map(a => <Chip key={a.id} label={a.label} selected={form.broadAudiences.includes(a.id)} onClick={() => setForm(f => ({ ...f, broadAudiences: tog(f.broadAudiences, a.id) }))} />)}
        </div>
      </Field>
      <Field label="Audiências segmentadas · ✦ maior performance">
        <div className="flex flex-wrap gap-2">
          {SEG_AUD.map(a => <Chip key={a.id} label={a.label} selected={form.segmentedAudiences.includes(a.id)} highlight onClick={() => setForm(f => ({ ...f, segmentedAudiences: tog(f.segmentedAudiences, a.id) }))} />)}
        </div>
        <p className="text-[10px] text-zinc-400 mt-1">2–3× maior taxa de conversão vs audiências amplas</p>
      </Field>
    </div>
  );
}

// ── Step 5: Criativos ─────────────────────────────────────────────────────────

function StepCriativos({ form, setForm }: { form: Form; setForm: React.Dispatch<React.SetStateAction<Form>> }) {
  const types = form.creativeIds.map(id => CREATIVES.find(c => c.id === id)?.type).filter(Boolean);
  return (
    <div className="flex flex-col gap-2">
      {CREATIVES.map(c => (
        <button key={c.id} onClick={() => setForm(f => ({ ...f, creativeIds: tog(f.creativeIds, c.id) }))}
          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${form.creativeIds.includes(c.id) ? "border-yellow-400 bg-yellow-50" : "border-zinc-200 hover:border-yellow-300"}`}>
          <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-lg flex-shrink-0">{c.icon}</div>
          <div className="flex-1"><div className="text-xs font-semibold">{c.name}</div><div className="text-[10px] text-zinc-400 mt-0.5">{c.type} · {c.size}</div></div>
          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${form.creativeIds.includes(c.id) ? "bg-yellow-400 border-yellow-400" : "border-zinc-300"}`}>
            {form.creativeIds.includes(c.id) && <Check size={11} className="text-black" />}
          </div>
        </button>
      ))}
      {form.creativeIds.length > 0 && !types.includes("Display") && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
          <Lightbulb size={13} className="flex-shrink-0 mt-0.5" />
          <span>Adicione um <strong>Banner Display</strong> para aumentar alcance em ~19%.</span>
        </div>
      )}
    </div>
  );
}

// ── Step 6: Pixel ─────────────────────────────────────────────────────────────

function StepPixel({ form, setForm }: { form: Form; setForm: React.Dispatch<React.SetStateAction<Form>> }) {
  return (
    <div className="flex flex-col gap-2">
      {PIXELS.map(p => (
        <button key={p.id} onClick={() => setForm(f => ({ ...f, pixelIds: tog(f.pixelIds, p.id), skipPixel: false }))}
          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${form.pixelIds.includes(p.id) ? "border-yellow-400 bg-yellow-50" : "border-zinc-200 hover:border-yellow-300"}`}>
          <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center text-base flex-shrink-0">{p.icon}</div>
          <div className="flex-1"><div className="text-xs font-semibold">{p.name}</div><div className="text-[10px] text-zinc-400 capitalize">{p.type}</div></div>
          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${form.pixelIds.includes(p.id) ? "bg-yellow-400 border-yellow-400" : "border-zinc-300"}`}>
            {form.pixelIds.includes(p.id) && <Check size={11} className="text-black" />}
          </div>
        </button>
      ))}
      <button onClick={() => setForm(f => ({ ...f, skipPixel: !f.skipPixel, pixelIds: [] }))}
        className="text-xs text-zinc-400 underline text-left mt-1">
        {form.skipPixel ? "↩ Ativar pixel (recomendado)" : "Continuar sem pixel (não recomendado)"}
      </button>
      {form.skipPixel && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span>Sem pixel o algoritmo não aprende. Campanhas com pixel têm <strong>47% mais eficiência</strong> de verba.</span>
        </div>
      )}
    </div>
  );
}

// ── Step 7: Revisão ───────────────────────────────────────────────────────────

function StepRevisao({ form }: { form: Form }) {
  const adv = ADVERTISERS.find(a => a.id === form.advertiserId);
  const goal = GOAL_OPTIONS.find(g => g.id === form.goal);
  const sL = form.geoStates.map(id => STATES.find(s => s.id === id)?.label).filter(Boolean);
  const bL = form.broadAudiences.map(id => BROAD_AUD.find(a => a.id === id)?.label).filter(Boolean);
  const saL = form.segmentedAudiences.map(id => SEG_AUD.find(a => a.id === id)?.label).filter(Boolean);
  const crL = form.creativeIds.map(id => CREATIVES.find(c => c.id === id)?.name).filter(Boolean);
  const pxL = form.pixelIds.map(id => PIXELS.find(p => p.id === id)?.name).filter(Boolean);
  const est = estimateImp(form);
  const Row = ({ label, val }: { label: string; val: string }) => (
    <div className="flex flex-col gap-0.5"><div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</div><div className="text-sm font-medium">{val}</div></div>
  );
  const Tags = ({ items }: { items: string[] }) => (
    <div className="flex flex-wrap gap-1 mt-0.5">{items.map((t, i) => <span key={i} className="px-2 py-0.5 bg-zinc-100 rounded text-[11px] font-medium text-zinc-600">{t}</span>)}</div>
  );
  return (
    <div className="flex flex-col gap-3">
      {est && (
        <div className="grid grid-cols-3 gap-2 mb-1">
          {[{ val: fmtNum(est.imps), label: "impressões est." }, { val: fmtNum(est.daily), label: "por dia" }, { val: `${est.days}d`, label: "duração" }].map(m => (
            <div key={m.label} className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-center">
              <div className="text-base font-bold tabular-nums">{m.val}</div>
              <div className="text-[10px] text-zinc-400 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
      )}
      <Row label="Anunciante" val={adv?.name || "—"} /><Row label="Objetivo" val={`${goal?.icon} ${goal?.label || "—"}`} />
      <hr className="border-zinc-100" />
      <Row label="Campanha" val={form.name || "—"} /><Row label="Período" val={`${fmtDate(form.startDate)} – ${fmtDate(form.endDate)}`} />
      <Row label="Orçamento" val={`${form.budget ? fmt$(form.budget) : "—"} · ${form.pacing === "daily" ? "Diário" : "Total"}`} /><Row label="Frequência" val={`${form.freqCap || 3}× / usuário / dia`} />
      <hr className="border-zinc-100" />
      <Row label="Grupo" val={form.groupName || "—"} /><Row label="Lance" val={`${form.bidType} ${form.bidValue ? fmt$(form.bidValue) : "—"}`} />
      <hr className="border-zinc-100" />
      <Row label="Mídia" val={form.mediaType} />
      <div><div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Estados</div><Tags items={sL.length ? sL : ["—"]} /></div>
      <div><div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Audiências</div><Tags items={[...bL, ...saL].length ? [...bL, ...saL] : ["—"]} /></div>
      <hr className="border-zinc-100" />
      <div><div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Criativos</div><Tags items={crL.length ? crL : ["—"]} /></div>
      <div><div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Rastreamento</div><Tags items={form.skipPixel ? ["Sem pixel"] : pxL.length ? pxL : ["—"]} /></div>
    </div>
  );
}

const STEP_COMPS = [null, StepObjetivo, StepConfig, StepGrupo, StepPublico, StepCriativos, StepPixel, StepRevisao];

// ── BriefingScreen ────────────────────────────────────────────────────────────

function BriefingScreen({
  userText, websiteUrl,
  onConfirm, onBack,
}: {
  userText: string; websiteUrl: string;
  onConfirm: (a: BriefingAnalysis) => void; onBack: () => void;
}) {
  const [phase, setPhase] = useState<"reading" | "thinking" | "done">(websiteUrl ? "reading" : "thinking");
  const [loadMsg, setLoadMsg] = useState(websiteUrl ? "Lendo o site do cliente…" : "A IA está analisando o briefing…");
  const [analysis, setAnalysis] = useState<BriefingAnalysis | null>(null);
  const [advId, setAdvId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      let webContent = "";
      if (websiteUrl) {
        try { webContent = await readUrl(websiteUrl); } catch { /* ignore read errors */ }
        setPhase("thinking");
        setLoadMsg("A IA está analisando o briefing + site…");
      }
      try {
        const result = GEMINI_KEY ? await callGemini(userText, webContent || undefined) : fallbackParse(userText);
        setAnalysis(result);
      } catch (e) {
        setAnalysis(fallbackParse(userText));
        if (GEMINI_KEY) setError("API indisponível — usando análise local.");
      }
      setPhase("done");
    };
    run();
  }, []);

  const handleConfirm = () => {
    if (!analysis) return;
    const adv = ADVERTISERS.find(a => a.id === advId);
    onConfirm({ ...analysis, wizardDefaults: { ...analysis.wizardDefaults, advertiserId: advId, advertiserName: adv?.name || "" } });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-8">

        {/* User bubble */}
        <div className="flex justify-end">
          <div className="bg-black text-yellow-400 rounded-tl-2xl rounded-br-2xl rounded-bl-2xl rounded-tr-sm px-4 py-3 text-sm font-medium max-w-md leading-relaxed">
            {userText}{websiteUrl && <div className="mt-2 flex items-center gap-1 text-yellow-300 text-[11px] opacity-80"><Globe size={10} />{websiteUrl}</div>}
          </div>
        </div>

        {phase !== "done" ? (
          <div className="flex flex-col gap-3">
            <TypingDots />
            <div className="pl-10 text-xs text-zinc-400 animate-pulse">{loadMsg}</div>
          </div>
        ) : analysis ? (
          <>
            <div className="flex gap-3 items-start">
              <AiAvatar />
              <div className="a-bubble ai text-sm leading-relaxed" style={{ maxWidth: 520 }}>
                Analisei o briefing{websiteUrl ? " e o site do cliente" : ""}. Detectei <strong>{analysis.businessLabel}</strong> com foco em <strong>{GOAL_OPTIONS.find(g => g.id === analysis.goal)?.label}</strong>.
                {analysis.businessDescription && <p className="mt-2 text-zinc-500 text-xs">{analysis.businessDescription}</p>}
                {error && <p className="mt-2 text-yellow-600 text-xs">{error}</p>}
              </div>
            </div>

            {/* Briefing card */}
            <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 bg-zinc-50">
                <span className="text-2xl">{analysis.businessIcon}</span>
                <span className="font-semibold text-sm">{analysis.businessLabel}</span>
                {websiteUrl && <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400"><Globe size={9} />{websiteUrl}</span>}
              </div>
              <div className="divide-y divide-zinc-100">
                {[
                  { label: "Anunciante", content: <Select value={advId} onChange={setAdvId}><option value="">Selecione…</option>{ADVERTISERS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>, conf: advId ? "detectado" : "—" },
                  { label: "Objetivo", content: <span className="text-sm font-medium">{GOAL_OPTIONS.find(g => g.id === analysis.goal)?.icon} {GOAL_OPTIONS.find(g => g.id === analysis.goal)?.label}</span>, conf: analysis.goalConfidence },
                  { label: "Investimento", content: <span className="text-sm font-medium">{analysis.budget ? fmt$(analysis.budget) : "— (defina no próximo passo)"}</span>, conf: analysis.budgetConfidence },
                  { label: "Período", content: <span className="text-sm font-medium">{fmtDate(analysis.startDate)} – {fmtDate(analysis.endDate)} · {analysis.periodLabel}</span>, conf: "sugerido" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">{row.label}</div>
                      {row.content}
                    </div>
                    {row.conf !== "—" && <ConfBadge conf={row.conf} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Strategic insights (AI extra thinking) */}
            {analysis.strategicInsights.length > 0 && (
              <div className="rounded-xl overflow-hidden border border-purple-200" style={{ background: "linear-gradient(135deg, rgba(185,94,240,.06), rgba(250,204,21,.08))" }}>
                <div className="px-4 py-3 border-b border-purple-100 flex items-center gap-2">
                  <Sparkles size={13} className="text-purple-500" />
                  <span className="text-xs font-bold text-purple-700">Insights além do briefing</span>
                </div>
                <div className="px-4 py-3 flex flex-col gap-3">
                  {analysis.strategicInsights.map((ins, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="text-base flex-shrink-0 mt-0.5">{ins.icon}</span>
                      <div><div className="text-xs font-semibold text-zinc-700 mb-0.5">{ins.title}</div><div className="text-xs text-zinc-500 leading-relaxed">{ins.text}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opportunities */}
            {analysis.opportunities.length > 0 && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
                <div className="flex items-center gap-2 mb-2"><Lightbulb size={12} className="text-yellow-600" /><span className="text-xs font-bold text-yellow-700">Oportunidades não mencionadas</span></div>
                {analysis.opportunities.map((op, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1"><ChevronRight size={11} className="text-yellow-500 flex-shrink-0 mt-0.5" /><span className="text-xs text-yellow-800">{op}</span></div>
                ))}
              </div>
            )}

            {/* Playbook */}
            {analysis.playbookRecs.length > 0 && (
              <div className="rounded-xl border border-zinc-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 text-xs font-bold flex items-center gap-2">
                  💡 Playbook: {analysis.businessLabel}
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  {analysis.playbookRecs.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-zinc-600 leading-relaxed">
                      <span className="flex-shrink-0">{r.icon}</span>
                      <span dangerouslySetInnerHTML={{ __html: r.text }} />
                    </div>
                  ))}
                  {analysis.periodAlert && (
                    <div className="flex items-start gap-2 mt-1 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 leading-relaxed">
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      <span>{analysis.periodAlert}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 items-center pt-1">
              <button
                onClick={advId ? handleConfirm : undefined}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${advId ? "bg-black text-yellow-400 hover:bg-zinc-800" : "bg-zinc-200 text-zinc-400 cursor-not-allowed"}`}>
                <Rocket size={14} />
                Montar campanha com esse playbook
              </button>
              <button onClick={onBack} className="text-xs text-zinc-400 underline">← Ajustar briefing</button>
            </div>
            {!advId && <p className="text-[10px] text-zinc-400">Selecione o anunciante para continuar</p>}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Wizard ────────────────────────────────────────────────────────────────────

function Wizard({ initialForm, briefingData, onSuccess }: { initialForm: Form; briefingData: BriefingAnalysis | null; onSuccess: (f: Form) => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [typing, setTyping] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (msgsRef.current) setTimeout(() => { msgsRef.current!.scrollTop = msgsRef.current!.scrollHeight; }, 80); }, [step, typing]);

  const advance = () => {
    if (step < 7) { setTyping(true); setTimeout(() => { setTyping(false); setStep(s => s + 1); }, 600); }
    else onSuccess(form);
  };

  const ok = canConfirm(step, form);
  const pct = Math.round(((step - 1) / 7) * 100);

  const aiMsg = (s: number): string => {
    const adv = ADVERTISERS.find(a => a.id === form.advertiserId);
    const g = GOAL_OPTIONS.find(x => x.id === form.goal);
    const pb = briefingData?.businessLabel;
    switch (s) {
      case 1: return briefingData ? `Confirme o anunciante e valide o objetivo detectado no briefing. Configurações do playbook de <strong>${pb}</strong> já aplicadas.` : "Selecione o anunciante e o objetivo — vou ajustar todas as recomendações para o seu caso.";
      case 2: return `${adv?.name} · <strong>${g?.label}</strong>. Período e orçamento pré-preenchidos pelo briefing. Ajuste e confirme:`;
      case 3: return `Lances pré-configurados pelo playbook de <strong>${pb || g?.label}</strong>. Ajuste conforme sua estratégia:`;
      case 4: { const r = form.geoStates.length > 0 ? `~<strong>${fmtNum(form.geoStates.length * 14)}M usuários únicos</strong> nos estados selecionados. ` : ""; return `Segmentação pré-preenchida. ${r}Chips roxos = audiências de maior performance para ${pb || g?.label}:`; }
      case 5: return form.creativeIds.length >= 2 ? `Você tem <strong>${form.creativeIds.length} formatos</strong> — combinação ideal para maximizar alcance.` : "Selecione ao menos um criativo para continuar:";
      case 6: return "Com <strong>Pixel de Conversão</strong> ativo, o algoritmo aprende quem converte e otimiza entrega automaticamente:";
      case 7: { const est = estimateImp(form); return `Campanha configurada como um Head de Mídia.${est ? ` Estimativa de <strong>${fmtNum(est.imps)} impressões</strong> em ${est.days} dias.` : ""} Revise e lance:`; }
      default: return "";
    }
  };

  const StepComp = STEP_COMPS[step] as React.ComponentType<{ form: Form; setForm: React.Dispatch<React.SetStateAction<Form>> }>;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-48 border-r border-zinc-100 p-4 flex flex-col gap-1 overflow-y-auto flex-shrink-0 hidden sm:flex">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-2 mb-1">Progresso</p>
        {WIZARD_STEPS.map(s => {
          const done = s.id < step, current = s.id === step;
          return (
            <button key={s.id} onClick={() => done && setStep(s.id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${current ? "bg-yellow-400 text-black" : done ? "text-zinc-500 hover:bg-zinc-50 cursor-pointer" : "text-zinc-300 cursor-default"}`}>
              <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${done || current ? "bg-black border-black text-yellow-400" : "border-current"}`}>
                {done ? <Check size={8} /> : s.id}
              </div>
              {s.title}
            </button>
          );
        })}
        <div className="mt-3 mx-2">
          <div className="h-1 rounded-full bg-zinc-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "var(--ai-grad)" }} />
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">{pct}% concluído</p>
        </div>
        {briefingData && (
          <div className="mt-4 mx-2 p-2 bg-zinc-50 rounded-lg border border-zinc-100">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Briefing</p>
            <p className="text-[10px] text-zinc-400 italic leading-relaxed line-clamp-3">{briefingData.businessDescription?.slice(0, 80)}…</p>
          </div>
        )}
      </aside>

      {/* Chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5" ref={msgsRef}>
          <div className="max-w-xl mx-auto flex flex-col gap-4 pb-8">

            {/* Done steps */}
            {WIZARD_STEPS.filter(s => s.id < step).map(s => (
              <div key={s.id}>
                <div className="flex gap-3 items-start mb-2">
                  <AiAvatar />
                  <div className="a-bubble ai text-sm" style={{ maxWidth: 460 }} dangerouslySetInnerHTML={{ __html: aiMsg(s.id) }} />
                </div>
                <div className="pl-11">
                  <div className="border border-zinc-200 rounded-xl px-4 py-3 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{WIZARD_STEPS[s.id - 1].title}</span>
                      <button onClick={() => setStep(s.id)} className="text-[11px] text-zinc-400 hover:text-zinc-600 font-medium px-2 py-0.5 rounded hover:bg-zinc-100">Editar</button>
                    </div>
                    <p className="text-sm font-medium">{getSummary(s.id, form)}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Current step */}
            <div className="flex gap-3 items-start">
              <AiAvatar />
              <div className="a-bubble ai text-sm" style={{ maxWidth: 460 }} dangerouslySetInnerHTML={{ __html: aiMsg(step) }} />
            </div>
            <div className="pl-11">
              <div className="border border-zinc-200 rounded-2xl p-4 bg-white shadow-sm" style={{ boxShadow: "0 2px 16px rgba(0,0,0,.05)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">{WIZARD_STEPS[step - 1].title}</p>
                <StepComp form={form} setForm={setForm as React.Dispatch<React.SetStateAction<Form>>} />
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={ok ? advance : undefined}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${ok ? "bg-yellow-400 text-black hover:bg-yellow-300" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"}`}>
                    {step === 7 ? <><Rocket size={13} /> Lançar Campanha</> : <>Parece ótimo <ArrowRight size={13} /></>}
                  </button>
                  {step > 1 && <button onClick={() => setStep(s => s - 1)} className="text-xs text-zinc-400 underline flex items-center gap-1"><ArrowLeft size={11} />Voltar</button>}
                </div>
              </div>
            </div>

            {typing && <TypingDots />}
            <div className="h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Quero vender mais roupas no Natal, tenho R$ 30k de verba",
  "Campanha de awareness para app de delivery em SP e RJ",
  "Black Friday performance — e-commerce de moda feminina",
  "Lançamento de conta digital para alta renda",
];

function Landing({ onSubmit }: { onSubmit: (text: string, url: string) => void }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [urlOpen, setUrlOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textRef.current?.focus(); }, []);

  const submit = () => { if (text.trim()) onSubmit(text.trim(), url.trim()); };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-7">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-lg font-black text-yellow-400"
          style={{ boxShadow: "0 0 0 10px rgba(250,204,21,.1)" }}>PR</div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Pixel Roads · IA</h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-sm leading-relaxed">Descreva o que você vende, o objetivo e o investimento — a IA monta a campanha como um Head de Mídia.</p>
        </div>
      </div>

      <div className="w-full max-w-xl">
        <div className="border-2 border-zinc-200 rounded-2xl overflow-hidden focus-within:border-yellow-400 transition-colors bg-white">
          <textarea
            ref={textRef}
            className="w-full min-h-[110px] px-5 py-4 text-sm bg-transparent border-none outline-none resize-none leading-relaxed text-zinc-900 placeholder:text-zinc-400"
            placeholder={"Descreva em poucas frases:\n• O que você vende ou promove\n• Qual o objetivo da campanha\n• Quanto pretende investir\n\nEx: Loja de moda feminina, quero vender mais no Natal, tenho R$ 40k de verba"}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) submit(); }}
          />
          {urlOpen && (
            <div className="px-4 pb-3 flex items-center gap-2">
              <Globe size={13} className="text-zinc-400 flex-shrink-0" />
              <input
                className="flex-1 text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-yellow-400 text-zinc-700"
                placeholder="URL do site do cliente (ex: renner.com.br)"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-400">⌘ Enter para enviar</span>
              <button onClick={() => setUrlOpen(v => !v)}
                className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${urlOpen ? "text-blue-500" : "text-zinc-400 hover:text-zinc-600"}`}>
                <Globe size={10} />{urlOpen ? "Remover URL" : "Adicionar site do cliente"}
              </button>
            </div>
            <button onClick={submit}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${text.trim() ? "bg-black text-yellow-400 hover:bg-zinc-800" : "bg-zinc-200 text-zinc-400"}`}>
              <Sparkles size={11} />Analisar
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center max-w-xl">
        {SUGGESTIONS.map((s, i) => (
          <button key={i} onClick={() => { setText(s); setTimeout(() => onSubmit(s, ""), 50); }}
            className="px-3 py-1.5 rounded-full bg-white border border-zinc-200 text-xs font-medium text-zinc-500 hover:bg-yellow-400 hover:text-black hover:border-yellow-400 transition-all">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Success ───────────────────────────────────────────────────────────────────

function Success({ form, onNew }: { form: Form; onNew: () => void }) {
  const est = estimateImp(form);
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
      <div className="text-6xl animate-bounce">🎉</div>
      <div>
        <h2 className="text-xl font-bold">Campanha lançada!</h2>
        <p className="text-zinc-400 text-sm mt-1 max-w-sm leading-relaxed"><strong>"{form.name}"</strong> foi enviada para aprovação e entra no ar em até 24h. Você montou isso como um Head de Mídia.</p>
      </div>
      {est && (
        <div className="flex gap-3">
          {[{ v: fmtNum(est.imps), l: "impressões est." }, { v: `${est.days}d`, l: "duração" }, { v: fmt$(form.bidValue), l: form.bidType }].map(m => (
            <div key={m.l} className="bg-zinc-50 border border-zinc-200 rounded-xl px-5 py-3 text-center">
              <div className="text-xl font-bold tabular-nums">{m.v}</div>
              <div className="text-[10px] text-zinc-400 mt-0.5">{m.l}</div>
            </div>
          ))}
        </div>
      )}
      <button onClick={onNew} className="px-5 py-2.5 rounded-xl bg-black text-yellow-400 font-semibold text-sm hover:bg-zinc-800 transition-colors">
        + Nova campanha
      </button>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CampaignCreator({ onBack }: { onBack?: () => void }) {
  const [screen, setScreen] = useState<Screen>("landing");
  const [briefText, setBriefText] = useState("");
  const [briefUrl, setBriefUrl] = useState("");
  const [briefingData, setBriefingData] = useState<BriefingAnalysis | null>(null);
  const [wizardForm, setWizardForm] = useState<Form>(defaultForm);
  const [doneForm, setDoneForm] = useState<Form | null>(null);

  const handleLanding = (text: string, url: string) => { setBriefText(text); setBriefUrl(url); setScreen("briefing"); };

  const handleBriefingConfirm = (analysis: BriefingAnalysis) => {
    setBriefingData(analysis);
    setWizardForm({ ...defaultForm, ...analysis.wizardDefaults, goal: analysis.wizardDefaults.goal || analysis.goal });
    setScreen("wizard");
  };

  const handleSuccess = (form: Form) => { setDoneForm(form); setScreen("success"); };

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      {/* Topbar */}
      <div className="a-topbar flex-shrink-0">
        <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center text-[10px] font-black text-yellow-400 flex-shrink-0">PR</div>
        <span className="text-sm font-semibold">
          {screen === "landing" ? "Pixel Roads · IA" : screen === "briefing" ? "Analisando briefing…" : screen === "wizard" ? "Nova Campanha" : "Campanha criada"}
          {screen === "wizard" && <span className="text-zinc-400 font-normal text-xs"> · IA ativa</span>}
        </span>
        {screen === "landing" && onBack && (
          <button onClick={onBack} className="ml-auto text-xs text-zinc-400 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50">← Voltar</button>
        )}
        {screen !== "landing" && (
          <button onClick={() => setScreen("landing")} className="ml-auto text-xs text-zinc-400 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50">
            {screen === "success" ? "← Início" : "✕ Sair"}
          </button>
        )}
      </div>

      {screen === "landing" && <Landing onSubmit={handleLanding} />}
      {screen === "briefing" && <BriefingScreen userText={briefText} websiteUrl={briefUrl} onConfirm={handleBriefingConfirm} onBack={() => setScreen("landing")} />}
      {screen === "wizard" && <Wizard initialForm={wizardForm} briefingData={briefingData} onSuccess={handleSuccess} />}
      {screen === "success" && doneForm && <Success form={doneForm} onNew={() => setScreen("landing")} />}
    </div>
  );
}
