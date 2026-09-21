import { useState, useEffect, useRef } from "react";
import {
  Send, ArrowRight, ArrowLeft, History, Database, CheckCircle2,
  ChevronRight, Info, Play, Tag, Layers, ShieldAlert,
  Pencil, Sparkles, Copy, Check
} from "lucide-react";
import { CampaignGoal, MediaStrategy, CampaignState, WizardMessage } from "./types";
import * as API from "./api";
import { BudgetSimulator } from "./components/BudgetSimulator";
import { InteractiveMap } from "./components/InteractiveMap";
import { CreativeUploader } from "./components/CreativeUploader";

// ─── MOCK DATA ───────────────────────────────────────────────────────────────
const MOCK_ADVERTISERS = [
  { id: "adv-1a2b3c4d-e5f6-0001", name: "AdsPlay Media Group" },
  { id: "adv-2b3c4d5e-f6a7-0002", name: "Pixel Roads Demo Store" },
  { id: "adv-3c4d5e6f-a7b8-0003", name: "Bradesco Digital" },
  { id: "adv-4d5e6f7a-b8c9-0004", name: "TechCorp Global" },
];

const STATE_DATA = [
  { id: "st-3e4a5b6c-7d8e-sp01", label: "São Paulo (SP)" },
  { id: "st-4f5b6c7d-8e9f-rj01", label: "Rio de Janeiro (RJ)" },
  { id: "st-5a6b7c8d-9e0f-mg01", label: "Belo Horizonte (MG)" },
  { id: "st-6b7c8d9e-0f1a-df01", label: "Brasília (DF)" },
  { id: "st-7c8d9e0f-1a2b-pr01", label: "Curitiba (PR)" },
  { id: "st-8d9e0f1a-2b3c-rs01", label: "Porto Alegre (RS)" },
];

const MOCK_CREATIVES = [
  { id: "cr-1a2b3c4d-e5f6-0001", name: "Banner Black Friday - 300x250.png", type: "Display", size: "120kb", dimensions: "300x250" },
  { id: "cr-2b3c4d5e-f6a7-0002", name: "Banner Awareness - 728x90.jpg", type: "Display", size: "180kb", dimensions: "728x90" },
  { id: "cr-3c4d5e6f-a7b8-0003", name: "Vídeo Institucional - 1920x1080.mp4", type: "Video", size: "24mb", dimensions: "1920x1080" },
  { id: "cr-4d5e6f7a-b8c9-0004", name: "Mobile App Feature - 320x50.gif", type: "Display", size: "45kb", dimensions: "320x50" },
];

const MOCK_BROAD = [
  { id: "aud-broad-a1b2c3d4-0001", label: "Tecnologia e Inovação (Affinity - Google)" },
  { id: "aud-broad-b2c3d4e5-0002", label: "Entusiastas de Automóveis (Affinity - Google)" },
  { id: "aud-broad-c3d4e5f6-0003", label: "Compradores de Imóveis (In-Market - Google)" },
  { id: "aud-broad-d4e5f6a7-0004", label: "Viajantes Frequentes (Affinity - Google)" },
  { id: "aud-broad-e5f6a7b8-0005", label: "Profissionais de Finanças (In-Market - Google)" },
  { id: "aud-broad-f6a7b8c9-0006", label: "Moda e Lifestyle (Affinity - Google)" },
];

const MOCK_SEGMENTED = [
  { id: "aud-seg-a1b2c3d4-0001", label: "Classe A/B - Serasa (3rd Party)" },
  { id: "aud-seg-b2c3d4e5-0002", label: "Investidores Alta Renda - Serasa (3rd Party)" },
  { id: "aud-seg-c3d4e5f6-0003", label: "C-Level - LinkedIn Segment (3rd Party)" },
  { id: "aud-seg-d4e5f6a7-0004", label: "E-commerce Recentes - Mastercard (3rd Party)" },
  { id: "aud-seg-e5f6a7b8-0005", label: "Pais e Mães - Target Data (3rd Party)" },
];

const AGE_RANGES = ["18", "25", "35", "45", "55", "65+"];

// ─── INITIAL STATE ────────────────────────────────────────────────────────────
const INITIAL_FORM: CampaignState = {
  advertiserId: MOCK_ADVERTISERS[0].id,
  advertiserName: MOCK_ADVERTISERS[0].name,
  campaignName: "",
  objective: "",
  startDate: "",
  endDate: "",
  budget: "",
  paymentModel: "PREPAID",
  groupName: "",
  groupDurationSame: true,
  groupStartDate: "",
  groupEndDate: "",
  groupBudget: "",
  cpcBidAutomatic: true,
  cpcBid: 3.5,
  cpmBidAutomatic: true,
  cpmBid: 12,
  lineName: "",
  strategy: "",
  geoMode: "region",
  targetStateIds: [],
  targetCityIds: [],
  radiusAddress: "Avenida Paulista, São Paulo - SP",
  radiusKm: 10,
  genders: ["Masculino", "Feminino", "Desconhecido"],
  ageRanges: ["18", "25", "35", "45", "55", "65+"],
  devices: ["Dispositivos móveis", "Computadores"],
  environments: ["Web", "Apps"],
  keywords: [],
  broadAudienceIds: [],
  segmentedAudienceIds: [],
  customAudienceRequested: false,
  customAudienceText: "",
  siteBlocklist: [],
  siteWhitelist: [],
  frequencyLimitEnabled: false,
  frequencyLimitImpressions: "",
  frequencyLimitPeriod: "dias",
  lookalike: false,
  creativesMode: "existing",
  selectedCreatives: [],
  pixelMode: "select",
  selectedPixelIds: [],
  newPixelName: "",
  newPixelType: "conversion",
  isDraft: false,
};

const STEP_NAMES = ["", "Objetivo", "Configurações", "Grupo & Lances", "Estratégia & Público", "Criativos", "Pixel", "Revisão"];
const STEP_INTROS = [
  "",
  "Qual é o objetivo principal desta campanha programática?",
  "Configure as informações básicas da campanha.",
  "Configure o grupo de anúncios e os lances automáticos.",
  "Defina a estratégia de mídia, segmentação geográfica e de público.",
  "Selecione ou adicione os criativos da campanha.",
  "Vincule um pixel para rastreamento e remarketing.",
  "Revise o payload gerado e autorize o lançamento.",
];

// ─── PAYLOAD BUILDER ──────────────────────────────────────────────────────────
const GENDER_MAP: Record<string, string> = { "Masculino": "MALE", "Feminino": "FEMALE", "Desconhecido": "UNKNOWN" };
const DEVICE_MAP: Record<string, string> = { "Dispositivos móveis": "MOBILE", "Computadores": "DESKTOP" };
const ENV_MAP: Record<string, string> = { "Web": "WEB", "Apps": "APP" };
const FREQ_MAP: Record<string, string> = { "horas": "HOURS", "dias": "DAYS", "semanas": "WEEKS" };

function toISOBR(dateStr: string): string {
  const p = dateStr.split("/");
  if (p.length !== 3) return dateStr;
  const [d, m, y] = p;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00-03:00`;
}

function toCents(val: number | ""): number {
  if (val === "" || isNaN(Number(val))) return 0;
  return Math.round(Number(val) * 100);
}

function buildPayload(form: CampaignState): Record<string, unknown> {
  const groupStart = form.groupDurationSame ? form.startDate : (form.groupStartDate || form.startDate);
  const groupEnd   = form.groupDurationSame ? form.endDate   : (form.groupEndDate   || form.endDate);
  const lineName   = form.lineName || `${form.strategy} - ${form.campaignName}`;

  const audiences = [
    ...form.broadAudienceIds.map(id => ({ audience_id: id, group_index: 0 })),
    ...form.segmentedAudienceIds.map(id => ({ audience_id: id, group_index: 1 })),
  ];

  const frequencyCap = form.frequencyLimitEnabled
    ? { type: "LIMITED", max_impressions: Number(form.frequencyLimitImpressions), time_unit: FREQ_MAP[form.frequencyLimitPeriod] ?? "DAYS", time_unit_count: 1 }
    : { type: "UNLIMITED" };

  const geo = form.geoMode === "region"
    ? { mode: "REGION", state_ids: form.targetStateIds, city_ids: form.targetCityIds }
    : { mode: "RADIUS", address: form.radiusAddress, radius_km: form.radiusKm };

  return {
    advertiser_id: form.advertiserId,
    name: form.campaignName,
    objective: form.objective,
    start_date: toISOBR(form.startDate),
    end_date: toISOBR(form.endDate),
    budget: toCents(form.budget),
    payment_model: form.paymentModel,
    is_draft: form.isDraft,
    package: {
      name: form.groupName,
      start_date: toISOBR(groupStart),
      end_date: toISOBR(groupEnd),
      budget: toCents(form.groupBudget),
      bid: {
        automatic: form.cpcBidAutomatic && form.cpmBidAutomatic,
        cpc: form.cpcBidAutomatic ? null : toCents(form.cpcBid),
        cpm: form.cpmBidAutomatic ? null : toCents(form.cpmBid),
      },
    },
    line: {
      name: lineName,
      strategy: form.strategy,
      geo,
      demographics: {
        genders: form.genders.filter(g => g !== "Desconhecido").map(g => GENDER_MAP[g]),
        age_ranges: form.ageRanges,
        age_unknown: form.genders.includes("Desconhecido"),
      },
      browser: form.devices.map(d => DEVICE_MAP[d]).filter(Boolean),
      environment: form.environments.map(e => ENV_MAP[e]).filter(Boolean),
      keywords: form.keywords,
      audiences,
      custom_audiences: form.customAudienceRequested ? [{ description: form.customAudienceText }] : [],
      wishlist: form.siteWhitelist,
      blacklist: form.siteBlocklist,
      creatives: form.selectedCreatives,
      frequency_cap: frequencyCap,
      targetingExpansion: form.lookalike,
    },
    pixels: form.selectedPixelIds,
  };
}

export default function App() {
  const [isOpen, setIsOpen]       = useState(false);
  const [step, setStep]           = useState(1);
  const [form, setForm]           = useState<CampaignState>(INITIAL_FORM);
  const [msgs, setMsgs]           = useState<WizardMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([
    { id: "c1", name: "Pixel_Roads - Busca_Paga_2025", advertiser: "AdsPlay", objective: "Vendas", budget: 50000, startDate: "21/06/2023", endDate: "Contínuo", status: "Ativo", invested: 34192.38, clicks: 20132, conversions: 2301, strategy: "Display" },
    { id: "c2", name: "teste", advertiser: "AdsPlay", objective: "Awareness", budget: 1500, startDate: "19/05/2026", endDate: "19/06/2026", status: "Pendente", invested: 0, clicks: 0, conversions: 0, strategy: "Video" },
  ]);
  const [pixels, setPixels]           = useState<any[]>([
    { id: "px-a1b2c3d4-e5f6-0001", name: "Pixel Conversão Global - AdsPlay", type: "conversion", installations: 1420 },
    { id: "px-b2c3d4e5-f6a7-0002", name: "Retargeting Home - Pixel Roads", type: "retargeting", installations: 5800 },
  ]);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showPixels, setShowPixels]       = useState(false);
  const [adminAlert, setAdminAlert]       = useState<string | null>(null);
  const [initPrompt, setInitPrompt]       = useState("");
  const [kwInput, setKwInput]             = useState("");
  const [blInput, setBlInput]             = useState("");
  const [wlInput, setWlInput]             = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── API-loaded data (fallback to mock when API not configured) ────────────
  const [apiAdvertisers, setApiAdvertisers] = useState<API.Advertiser[]>([]);
  const [apiStates, setApiStates]           = useState<API.GeoState[]>([]);
  const [apiBroad, setApiBroad]             = useState<API.Audience[]>([]);
  const [apiSegmented, setApiSegmented]     = useState<API.Audience[]>([]);
  const [apiCreatives, setApiCreatives]     = useState<API.Creative[]>([]);
  const [apiPixels, setApiPixels]           = useState<API.Pixel[]>([]);

  useEffect(() => {
    if (!API.isConfigured) return;
    API.fetchAdvertisers().then(setApiAdvertisers).catch(console.error);
    API.fetchStates().then(setApiStates).catch(console.error);
    API.fetchBroadAudiences().then(setApiBroad).catch(console.error);
    API.fetchSegmentedAudiences().then(setApiSegmented).catch(console.error);
  }, []);

  useEffect(() => {
    if (!API.isConfigured || !form.advertiserId) return;
    API.fetchCreatives(form.advertiserId).then(setApiCreatives).catch(console.error);
    API.fetchPixels(form.advertiserId).then(data => {
      setApiPixels(data);
      setPixels(data.map(p => ({ ...p, installations: 0 })));
    }).catch(console.error);
  }, [form.advertiserId]);

  const advertiserList = apiAdvertisers.length > 0 ? apiAdvertisers : MOCK_ADVERTISERS;
  const stateList      = apiStates.length > 0 ? apiStates : STATE_DATA;
  const broadList      = apiBroad.length > 0 ? apiBroad : MOCK_BROAD;
  const segmentedList  = apiSegmented.length > 0 ? apiSegmented : MOCK_SEGMENTED;
  const creativeList   = apiCreatives.length > 0 ? apiCreatives : MOCK_CREATIVES;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, aiLoading]);

  const stateLabel = (id: string) => stateList.find(s => s.id === id)?.label ?? id;
  const pixelName  = (id: string) => pixels.find(p => p.id === id)?.name ?? "—";

  const calcDays = (start: string, end: string): number => {
    try {
      const p = (s: string) => { const x = s.split("/"); return x.length === 3 ? new Date(+x[2], +x[1] - 1, +x[0]) : new Date(s); };
      const d = Math.ceil(Math.abs(p(end).getTime() - p(start).getTime()) / 86400000);
      return isNaN(d) ? 0 : d;
    } catch { return 0; }
  };

  const getStepSummary = (s: number): string => {
    switch (s) {
      case 1: return `Objetivo: ${form.objective}`;
      case 2: {
        const days = calcDays(form.startDate, form.endDate);
        return `${form.campaignName} · R$ ${Number(form.budget).toLocaleString("pt-BR")} · ${form.startDate} → ${form.endDate}${days > 0 ? ` (${days} dias)` : ""}`;
      }
      case 3: return `Grupo "${form.groupName}" · R$ ${Number(form.groupBudget).toLocaleString("pt-BR")} · ${form.cpcBidAutomatic ? "Lances automáticos" : `CPC R$${form.cpcBid}`}`;
      case 4: {
        const regionsPart = form.targetStateIds.length > 0 ? form.targetStateIds.map(stateLabel).join(", ") : "Nacional";
        return `${form.strategy} · ${regionsPart} · ${form.genders.join(", ")}`;
      }
      case 5: return `${form.selectedCreatives.length} criativo(s)`;
      case 6: return form.selectedPixelIds.length > 0 ? form.selectedPixelIds.map(pixelName).join(", ") : form.newPixelName || "—";
      case 7: return "Payload gerado · pronto para veiculação.";
      default: return "Concluído";
    }
  };

  const canConfirm = (s: number): boolean => {
    if (s === 1) return form.objective !== "";
    if (s === 2) {
      if (!form.campaignName || !form.startDate || !form.endDate || !form.budget) return false;
      const days = calcDays(form.startDate, form.endDate);
      return days >= 1 && Number(form.budget) / days >= 10;
    }
    if (s === 3) return !!(form.groupName && form.groupBudget && Number(form.groupBudget) <= Number(form.budget));
    if (s === 4) return form.strategy !== "";
    return true;
  };

  const openWizard = (prompt?: string) => {
    setIsOpen(true);
    setStep(1);
    setMsgs([
      { id: "greet", type: "ai-text", text: "Olá! Sou o assistente de mídia programática da Pixel Roads. Vou te guiar na criação da sua campanha passo a passo." },
      { id: "s1", type: "step-active", step: 1 },
    ]);
    if (prompt?.trim()) setTimeout(() => callAI(prompt), 400);
  };

  const confirmStep = (s: number) => {
    const summary = getStepSummary(s);
    setMsgs(prev => {
      const updated = prev.map(m =>
        m.type === "step-active" && m.step === s ? { ...m, type: "step-done" as const, summary } : m
      );
      if (s < 7) {
        return [...updated,
          { id: `u${s}`, type: "user-text" as const, text: summary },
          { id: `s${s + 1}`, type: "step-active" as const, step: s + 1 },
        ];
      }
      return [...updated, { id: `u${s}`, type: "user-text" as const, text: summary }];
    });
    setStep(s + 1);
    if (s === 7) handleLaunch();
  };

  const editStep = (s: number) => {
    setStep(s);
    setMsgs(prev => {
      const idx = prev.findIndex(m => m.step === s);
      if (idx === -1) return prev;
      return [...prev.slice(0, idx), { id: `s${s}-edit`, type: "step-active" as const, step: s }];
    });
  };

  const handleLaunch = async () => {
    const payload = buildPayload(form);
    let campId = `camp-${Date.now()}`;
    if (API.isConfigured) {
      try {
        const res = await API.saveCampaign(payload);
        campId = res.id;
      } catch (e) {
        console.error("Erro ao salvar campanha:", e);
        setAdminAlert("Erro ao salvar campanha na API. Verifique o console.");
        return;
      }
    }
    const camp = {
      id: campId,
      name: form.campaignName || "Nova Campanha IA",
      advertiser: form.advertiserName,
      objective: form.objective || "Awareness",
      budget: Number(form.budget) || 1000,
      startDate: form.startDate || "—",
      endDate: form.endDate || "—",
      status: form.isDraft ? "Rascunho" : "Ativo",
      invested: 0, clicks: 0, conversions: 0,
      strategy: form.strategy || "Display",
    };
    setCampaigns(prev => [camp, ...prev]);
    setTimeout(() => { setIsOpen(false); setShowCampaigns(true); }, 400);
  };

  const callAI = async (text: string) => {
    setAiLoading(true);
    const userMsg: WizardMessage = { id: `u-${Date.now()}`, type: "user-text", text };
    setMsgs(prev => [...prev, userMsg]);
    try {
      const res = await fetch("/api/campaign/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, currentCampaignState: form }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.campaignUpdates) {
        const u = data.campaignUpdates;
        setForm(prev => {
          const next = { ...prev };
          if (u.objective) next.objective = u.objective;
          if (u.campaignName) next.campaignName = u.campaignName;
          if (u.startDate) next.startDate = u.startDate;
          if (u.endDate) next.endDate = u.endDate;
          if (u.budget != null) { next.budget = u.budget; next.groupBudget = u.budget; }
          if (u.groupName) next.groupName = u.groupName;
          if (u.strategy) next.strategy = u.strategy;
          if (u.targetStateIds?.length) next.targetStateIds = u.targetStateIds;
          if (u.keywords?.length) next.keywords = u.keywords.slice(0, 5);
          return next;
        });
      }
      setMsgs(prev => [...prev, { id: `ai-${Date.now()}`, type: "ai-text", text: data.message }]);
    } catch {
      setMsgs(prev => [...prev, { id: `ai-err-${Date.now()}`, type: "ai-text", text: "Entendido! Atualizei os parâmetros disponíveis. Continue preenchendo os passos abaixo." }]);
    } finally {
      setAiLoading(false);
    }
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    callAI(chatInput);
    setChatInput("");
  };

  const set = (patch: Partial<CampaignState>) => setForm(prev => ({ ...prev, ...patch }));
  const toggle = <K extends keyof CampaignState>(key: K, val: string) => {
    const arr = (form[key] as string[]);
    set({ [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] } as any);
  };

  const copyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(buildPayload(form), null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── STEP FORMS ──────────────────────────────────────────────────────────────
  const renderStep = (s: number) => {
    switch (s) {
      case 1: return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {([
            [CampaignGoal.AWARENESS, "Awareness", "Reconhecimento de marca"],
            [CampaignGoal.ENGAGEMENT, "Engajamento", "Cliques e interações"],
            [CampaignGoal.VENDAS, "Vendas", "Conversões diretas"],
            [CampaignGoal.MISTO, "Misto", "Funil completo"],
          ] as [string, string, string][]).map(([key, label, desc]) => (
            <button key={key} type="button" onClick={() => set({ objective: key as CampaignGoal })}
              className={`a-card-opt text-left ${form.objective === key ? "sel" : ""}`}>
              <span className="label">{label}</span>
              <span className="desc">{desc}</span>
            </button>
          ))}
        </div>
      );

      case 2: return (
        <div className="space-y-3 mt-3">
          <div className="a-field-grid">
            <div className="a-field">
              <label>Anunciante</label>
              <select value={form.advertiserId} onChange={e => {
                const adv = advertiserList.find(a => a.id === e.target.value);
                if (adv) set({ advertiserId: adv.id, advertiserName: adv.name });
              }}>
                {advertiserList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="a-field">
              <label>Nome da campanha</label>
              <input type="text" placeholder="ex: Awareness Junho" value={form.campaignName} onChange={e => set({ campaignName: e.target.value })} />
            </div>
          </div>
          <div className="a-field-grid">
            <div className="a-field">
              <label>Data de início</label>
              <input type="text" placeholder="DD/MM/AAAA" value={form.startDate} onChange={e => set({ startDate: e.target.value })} />
            </div>
            <div className="a-field">
              <label>Data de término</label>
              <input type="text" placeholder="DD/MM/AAAA" value={form.endDate} onChange={e => set({ endDate: e.target.value })} />
            </div>
          </div>
          <div className="a-field-grid">
            <div className="a-field">
              <label>Orçamento total (R$)</label>
              <input type="number" placeholder="ex: 5000" value={form.budget}
                onChange={e => set({ budget: e.target.value === "" ? "" : +e.target.value, groupBudget: e.target.value === "" ? "" : +e.target.value })} />
            </div>
            <div className="a-field">
              <label>Modelo de pagamento</label>
              <select value={form.paymentModel} onChange={e => set({ paymentModel: e.target.value as "PREPAID" | "POSTPAID" })}>
                <option value="PREPAID">Pré-pago</option>
                <option value="POSTPAID">Pós-pago</option>
              </select>
            </div>
          </div>
          {(form.budget || form.startDate) && (
            <BudgetSimulator totalBudget={form.budget} startDate={form.startDate} endDate={form.endDate} />
          )}
        </div>
      );

      case 3: return (
        <div className="space-y-3 mt-3">
          <div className="a-field-grid">
            <div className="a-field">
              <label>Nome do grupo</label>
              <input type="text" placeholder="ex: SP Principal" value={form.groupName} onChange={e => set({ groupName: e.target.value })} />
            </div>
            <div className="a-field">
              <label>Orçamento do grupo (R$)</label>
              <input type="number" placeholder={String(form.budget || "")} value={form.groupBudget}
                onChange={e => set({ groupBudget: e.target.value === "" ? "" : +e.target.value })} />
            </div>
          </div>
          <div className="a-field-grid">
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-700">Lance CPC</span>
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer font-semibold">
                  <input type="checkbox" checked={form.cpcBidAutomatic} onChange={e => set({ cpcBidAutomatic: e.target.checked })} className="accent-yellow-400" />
                  Automático
                </label>
              </div>
              <input type="number" disabled={form.cpcBidAutomatic} value={form.cpcBid} onChange={e => set({ cpcBid: +e.target.value })}
                className="w-full text-xs p-2 border border-zinc-200 rounded bg-white disabled:bg-zinc-100 disabled:text-zinc-400 outline-none focus:border-black" />
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-700">Lance CPM</span>
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer font-semibold">
                  <input type="checkbox" checked={form.cpmBidAutomatic} onChange={e => set({ cpmBidAutomatic: e.target.checked })} className="accent-yellow-400" />
                  Automático
                </label>
              </div>
              <input type="number" disabled={form.cpmBidAutomatic} value={form.cpmBid} onChange={e => set({ cpmBid: +e.target.value })}
                className="w-full text-xs p-2 border border-zinc-200 rounded bg-white disabled:bg-zinc-100 disabled:text-zinc-400 outline-none focus:border-black" />
            </div>
          </div>
          {form.groupBudget && Number(form.groupBudget) > Number(form.budget) && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg">O orçamento do grupo não pode exceder o da campanha (R$ {Number(form.budget).toLocaleString("pt-BR")}).</p>
          )}
        </div>
      );

      case 4: return (
        <div className="space-y-4 mt-3 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Formato de Anúncio</p>
            <div className="a-toggle-row">
              <button type="button" onClick={() => set({ strategy: MediaStrategy.DISPLAY })} className={`a-toggle ${form.strategy === MediaStrategy.DISPLAY ? "on" : ""}`}>
                <Tag className="h-3.5 w-3.5 inline mr-1.5" />Display
              </button>
              <button type="button" onClick={() => set({ strategy: MediaStrategy.VIDEO })} className={`a-toggle ${form.strategy === MediaStrategy.VIDEO ? "on" : ""}`}>
                <Play className="h-3.5 w-3.5 inline mr-1.5" />Vídeo
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Segmentação Geográfica</p>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => set({ geoMode: "region" })} className={`a-toggle text-xs flex-1 ${form.geoMode === "region" ? "on" : ""}`}>Regiões</button>
              <button type="button" onClick={() => set({ geoMode: "radius" })} className={`a-toggle text-xs flex-1 ${form.geoMode === "radius" ? "on" : ""}`}>Raio</button>
            </div>
            {form.geoMode === "region" ? (
              <div className="a-chip-list">
                {stateList.map(st => (
                  <button key={st.id} type="button" onClick={() => toggle("targetStateIds", st.id)}
                    className={`a-chip ${form.targetStateIds.includes(st.id) ? "sel" : ""}`}>
                    {form.targetStateIds.includes(st.id) ? "✓ " : ""}{st.label}
                  </button>
                ))}
              </div>
            ) : (
              <InteractiveMap address={form.radiusAddress} setAddress={v => set({ radiusAddress: v })}
                radius={form.radiusKm} setRadius={r => set({ radiusKm: r })} />
            )}
          </div>

          <div className="a-field-grid">
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Gênero</p>
              <div className="a-chip-list">
                {["Masculino", "Feminino", "Desconhecido"].map(g => (
                  <button key={g} type="button" onClick={() => toggle("genders", g)} className={`a-chip ${form.genders.includes(g) ? "sel" : ""}`}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Faixa etária</p>
              <div className="a-chip-list">
                {AGE_RANGES.map(a => (
                  <button key={a} type="button" onClick={() => toggle("ageRanges", a)} className={`a-chip ${form.ageRanges.includes(a) ? "sel" : ""}`}>{a}+</button>
                ))}
              </div>
            </div>
          </div>

          <div className="a-field-grid">
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Dispositivos</p>
              <div className="a-chip-list">
                {["Dispositivos móveis", "Computadores"].map(d => (
                  <button key={d} type="button" onClick={() => toggle("devices", d)} className={`a-chip ${form.devices.includes(d) ? "sel" : ""}`}>{d}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Ambiente</p>
              <div className="a-chip-list">
                {["Web", "Apps"].map(e => (
                  <button key={e} type="button" onClick={() => toggle("environments", e)} className={`a-chip ${form.environments.includes(e) ? "sel" : ""}`}>{e}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Palavras-chave <span className="font-normal text-zinc-400">(máx 5, opcional)</span></p>
            <div className="flex gap-2">
              <input type="text" placeholder="Termo de interesse..." value={kwInput} onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && kwInput.trim() && form.keywords.length < 5) { set({ keywords: [...form.keywords, kwInput.trim()] }); setKwInput(""); } }}
                className="flex-1 text-xs p-2 border border-zinc-200 rounded-lg bg-white outline-none focus:border-black" />
              <button type="button" disabled={!kwInput.trim() || form.keywords.length >= 5}
                onClick={() => { if (kwInput.trim() && form.keywords.length < 5) { set({ keywords: [...form.keywords, kwInput.trim()] }); setKwInput(""); } }}
                className="text-xs bg-black text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-40">+ Adicionar</button>
            </div>
            {form.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.keywords.map(k => (
                  <span key={k} className="a-chip sel text-xs">
                    {k}
                    <button type="button" onClick={() => set({ keywords: form.keywords.filter(x => x !== k) })} className="text-red-500 ml-1 font-bold">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="a-field-grid">
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Audiências Amplas (Google)</p>
              <div className="space-y-1 max-h-[130px] overflow-y-auto border border-zinc-200 rounded-lg p-2 bg-white">
                {broadList.map(a => (
                  <label key={a.id} className="flex items-center gap-1.5 text-[11px] text-zinc-600 cursor-pointer hover:text-black py-0.5">
                    <input type="checkbox" checked={form.broadAudienceIds.includes(a.id)} onChange={() => toggle("broadAudienceIds", a.id)} className="accent-yellow-400 shrink-0" />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Dados Enriquecidos (Serasa)</p>
              <div className="space-y-1 max-h-[130px] overflow-y-auto border border-zinc-200 rounded-lg p-2 bg-white">
                {segmentedList.map(a => (
                  <label key={a.id} className="flex items-center gap-1.5 text-[11px] text-zinc-600 cursor-pointer hover:text-black py-0.5">
                    <input type="checkbox" checked={form.segmentedAudienceIds.includes(a.id)} onChange={() => toggle("segmentedAudienceIds", a.id)} className="accent-yellow-400 shrink-0" />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="a-field-grid">
            <div>
              <p className="text-xs font-bold text-red-400 uppercase mb-1">Blocklist (opcional)</p>
              <div className="flex gap-1.5">
                <input type="text" placeholder="https://site.com/" value={blInput} onChange={e => setBlInput(e.target.value)}
                  className="flex-1 text-xs p-1.5 bg-white border border-zinc-200 rounded-lg font-mono outline-none focus:border-black" />
                <button type="button" onClick={() => { if (blInput.startsWith("https://")) { set({ siteBlocklist: [...form.siteBlocklist, blInput] }); setBlInput(""); } }}
                  className="bg-red-600 text-white text-xs px-2.5 py-1 rounded-lg font-bold">Bloquear</button>
              </div>
              {form.siteBlocklist.map(s => <span key={s} className="text-[9px] bg-red-50 text-red-500 border border-red-200 rounded px-1.5 py-0.5 font-mono block mt-1 truncate">{s}</span>)}
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Whitelist (opcional)</p>
              <div className="flex gap-1.5">
                <input type="text" placeholder="https://site.com/" value={wlInput} onChange={e => setWlInput(e.target.value)}
                  className="flex-1 text-xs p-1.5 bg-white border border-zinc-200 rounded-lg font-mono outline-none focus:border-black" />
                <button type="button" onClick={() => { if (wlInput.startsWith("https://")) { set({ siteWhitelist: [...form.siteWhitelist, wlInput] }); setWlInput(""); } }}
                  className="bg-zinc-800 text-yellow-400 text-xs px-2.5 py-1 rounded-lg font-bold">Exclusivo</button>
              </div>
              {form.siteWhitelist.map(s => <span key={s} className="text-[9px] bg-zinc-100 text-zinc-600 border border-zinc-200 rounded px-1.5 py-0.5 font-mono block mt-1 truncate">{s}</span>)}
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-zinc-700">
              <input type="checkbox" checked={form.frequencyLimitEnabled} onChange={e => set({ frequencyLimitEnabled: e.target.checked })} className="accent-yellow-400" />
              Limite de Frequência
            </label>
            {form.frequencyLimitEnabled && (
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="text-zinc-500">Limitar a</span>
                <input type="number" className="w-14 p-1.5 border border-zinc-200 rounded text-center font-bold outline-none focus:border-black" placeholder="3"
                  value={form.frequencyLimitImpressions} onChange={e => set({ frequencyLimitImpressions: e.target.value === "" ? "" : +e.target.value })} />
                <span className="text-zinc-500">impressões por</span>
                <select value={form.frequencyLimitPeriod} onChange={e => set({ frequencyLimitPeriod: e.target.value })}
                  className="p-1.5 border border-zinc-200 rounded bg-white text-zinc-700 text-xs outline-none focus:border-black">
                  <option value="horas">Horas</option>
                  <option value="dias">Dias</option>
                  <option value="semanas">Semanas</option>
                </select>
              </div>
            )}
          </div>

          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-zinc-800">Expansão Look-a-like</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Expande para perfis similares · reduz custo de conversão</p>
            </div>
            <button type="button" onClick={() => set({ lookalike: !form.lookalike })}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors cursor-pointer ${form.lookalike ? "bg-yellow-400" : "bg-zinc-300"}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${form.lookalike ? "translate-x-4 ml-0.5" : "ml-0.5"}`} />
            </button>
          </div>
        </div>
      );

      case 5: return (
        <div className="space-y-3 mt-3">
          <div className="flex gap-3 mb-2">
            <button type="button" onClick={() => set({ creativesMode: "existing" })}
              className={`a-toggle text-xs flex-1 ${form.creativesMode === "existing" ? "on" : ""}`}>Criativos existentes</button>
            <button type="button" onClick={() => set({ creativesMode: "new" })}
              className={`a-toggle text-xs flex-1 ${form.creativesMode === "new" ? "on" : ""}`}>Novo upload</button>
          </div>
          {form.creativesMode === "existing" ? (
            <div className="space-y-2">
              {creativeList.filter(c => !form.strategy || c.type === form.strategy).map(c => (
                <label key={c.id} className={`a-list-row ${form.selectedCreatives.includes(c.id) ? "sel" : ""}`}>
                  <span className="ava text-[10px] font-mono">{c.type === "Video" ? "▶" : "▭"}</span>
                  <span className="meta"><span className="n">{c.name}</span><span className="s">{c.type} · {c.size} · {c.dimensions}</span></span>
                  <span className="check">
                    <input type="checkbox" checked={form.selectedCreatives.includes(c.id)} onChange={() => toggle("selectedCreatives", c.id)} className="accent-yellow-400" />
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <CreativeUploader strategy={form.strategy} onCreativeAdded={() => {
              const id = `cr-upload-${Date.now()}`;
              set({ selectedCreatives: [...form.selectedCreatives, id] });
            }} />
          )}
        </div>
      );

      case 6: return (
        <div className="space-y-3 mt-3">
          <div className="flex gap-3 mb-2">
            <button type="button" onClick={() => set({ pixelMode: "select" })} className={`a-toggle text-xs flex-1 ${form.pixelMode === "select" ? "on" : ""}`}>Selecionar existente</button>
            <button type="button" onClick={() => set({ pixelMode: "create" })} className={`a-toggle text-xs flex-1 ${form.pixelMode === "create" ? "on" : ""}`}>Criar novo</button>
          </div>
          {form.pixelMode === "select" ? (
            <div className="space-y-2">
              {pixels.map(px => (
                <label key={px.id} className={`a-list-row ${form.selectedPixelIds.includes(px.id) ? "sel" : ""}`}>
                  <span className="ava text-[9px] font-bold">{px.type === "conversion" ? "CV" : "RT"}</span>
                  <span className="meta">
                    <span className="n">{px.name}</span>
                    <span className="s">{px.type === "conversion" ? "Conversão" : "Remarketing"} · {px.installations} acionamentos</span>
                  </span>
                  <span className="check">
                    <input type="checkbox" checked={form.selectedPixelIds.includes(px.id)} onChange={() => toggle("selectedPixelIds", px.id)} className="accent-yellow-400" />
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="a-field">
                <label>Nome do pixel</label>
                <input type="text" placeholder="ex: Pixel Checkout Campanha SP" value={form.newPixelName} onChange={e => set({ newPixelName: e.target.value })} />
              </div>
              <div className="flex gap-2">
                {["conversion", "retargeting"].map(t => (
                  <button key={t} type="button" onClick={() => set({ newPixelType: t as "conversion" | "retargeting" })}
                    className={`a-toggle text-xs flex-1 ${form.newPixelType === t ? "on" : ""}`}>
                    {t === "conversion" ? "Conversão" : "Remarketing"}
                  </button>
                ))}
              </div>
              <button type="button" disabled={!form.newPixelName} onClick={() => {
                const px = { id: `px-${Date.now()}`, name: form.newPixelName, type: form.newPixelType, installations: 0 };
                setPixels(prev => [...prev, px]);
                set({ pixelMode: "select", selectedPixelIds: [...form.selectedPixelIds, px.id], newPixelName: "" });
              }} className="w-full bg-black text-white text-xs font-bold py-2 rounded-lg disabled:opacity-40 cursor-pointer hover:bg-zinc-800">
                Criar Pixel
              </button>
            </div>
          )}
        </div>
      );

      case 7: {
        const payload = buildPayload(form);
        return (
          <div className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-500 font-mono">Payload · Pixel Roads API</span>
              <button type="button" onClick={copyPayload}
                className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${copied ? "bg-emerald-600 text-white" : "bg-zinc-800 text-yellow-400 hover:bg-black"}`}>
                {copied ? <><Check className="h-3 w-3" /> Copiado!</> : <><Copy className="h-3 w-3" /> Copiar JSON</>}
              </button>
            </div>
            <pre className="bg-zinc-950 text-emerald-400 text-[10px] font-mono p-4 rounded-xl overflow-auto max-h-[52vh] leading-relaxed border border-zinc-800 whitespace-pre-wrap break-all">
              {JSON.stringify(payload, null, 2)}
            </pre>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer text-zinc-600">
                <input type="checkbox" checked={form.isDraft} onChange={e => set({ isDraft: e.target.checked })} className="accent-yellow-400" />
                Salvar como rascunho (is_draft: true)
              </label>
            </div>
            <p className="text-[10px] text-zinc-400 text-center">Ao confirmar, a campanha entrará na fila de veiculação programática da Pixel Roads.</p>
          </div>
        );
      }

      default: return null;
    }
  };

  // ─── MESSAGE RENDERER ─────────────────────────────────────────────────────
  const renderMessage = (msg: WizardMessage) => {
    if (msg.type === "user-text") {
      return (
        <div key={msg.id} className="a-bubble user">
          <p>{msg.text}</p>
        </div>
      );
    }

    if (msg.type === "ai-text") {
      return (
        <div key={msg.id} className="a-bubble ai">
          <div className="a-aihead">
            <span className="ai-avatar">AI</span>
            Pixel Roads Intelligence
            <span className="why"><b>Recomendado</b></span>
          </div>
          <p>{msg.text}</p>
        </div>
      );
    }

    if (msg.type === "step-done") {
      return (
        <div key={msg.id} className="step-done-bubble">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500">
              <span className="font-black text-zinc-700">{STEP_NAMES[msg.step!]}</span>
              {" — "}{msg.summary}
            </span>
            <button type="button" onClick={() => editStep(msg.step!)}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-black font-semibold transition-colors cursor-pointer ml-3 shrink-0">
              <Pencil className="h-3 w-3" /> Editar
            </button>
          </div>
        </div>
      );
    }

    if (msg.type === "step-active") {
      const s = msg.step!;
      const ok = canConfirm(s);
      return (
        <div key={msg.id} className="a-bubble ai step-card">
          <div className="a-aihead">
            <span className="ai-avatar">AI</span>
            Pixel Roads · {STEP_NAMES[s]}
            <span className="step-badge">{s}/7</span>
          </div>
          <p className="font-semibold text-zinc-800 text-sm">{STEP_INTROS[s]}</p>
          {renderStep(s)}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
            {s > 1 ? (
              <button type="button" onClick={() => editStep(s - 1)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-black font-bold transition-colors cursor-pointer">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
            ) : <span />}
            <button type="button" disabled={!ok} onClick={() => confirmStep(s)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${ok ? "bg-black text-white hover:bg-zinc-800 active:scale-[0.98]" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"}`}>
              {s === 7 ? <><CheckCircle2 className="h-3.5 w-3.5" /> Aprovar & Lançar</> : <>Confirmar <ArrowRight className="h-3.5 w-3.5" /></>}
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  // ─── SIDEBAR ──────────────────────────────────────────────────────────────
  const regionsSummary = form.targetStateIds.length > 0
    ? form.targetStateIds.map(stateLabel).join(", ")
    : form.startDate ? "Nacional" : "—";

  const pixelSummary = form.selectedPixelIds.length > 0
    ? form.selectedPixelIds.map(id => pixelName(id).split(" - ")[0]).join(", ")
    : "—";

  const sidebar = (
    <aside className="a-sidebar">
      <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
        <div className="h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
        <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-700">Status da Campanha</h4>
      </div>
      <div className="space-y-2">
        {[
          ["Objetivo", form.objective || "—"],
          ["Nome", form.campaignName || "—"],
          ["Formato", form.strategy || "—"],
          ["Orçamento", form.budget ? `R$ ${Number(form.budget).toLocaleString("pt-BR")}` : "—"],
          ["Período", form.startDate && form.endDate ? `${form.startDate} → ${form.endDate}` : "—"],
          ["Regiões", regionsSummary],
          ["Pixel", pixelSummary],
        ].map(([k, v]) => (
          <div key={k} className="a-side-card">
            <h4>{k}</h4>
            <span className={`value ${v === "—" ? "opacity-40" : ""}`}>{v}</span>
          </div>
        ))}
      </div>
      <div className="a-side-card hi mt-auto">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Info className="h-3.5 w-3.5 text-zinc-600" />
          <h4 className="text-[10px] font-black uppercase text-zinc-600">Dica Técnica</h4>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">Campanhas com <strong>30+ dias</strong> têm melhor otimização via IA. Use lances automáticos para reduzir CPM.</p>
      </div>
    </aside>
  );

  // ─── LANDING PAGE ─────────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col">
        <header className="a-topbar">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-black text-yellow-400 flex items-center justify-center font-black text-xs select-none">PR</div>
            <div>
              <span className="text-sm font-black tracking-wider text-black uppercase flex items-center gap-1">
                Pixel Roads <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              </span>
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Mídia Programática</p>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-auto text-xs font-semibold">
            <button onClick={() => setShowCampaigns(true)}
              className="flex items-center gap-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 rounded-full text-zinc-700 transition-colors cursor-pointer">
              <History className="h-3.5 w-3.5" /> Campanhas
              <span className="bg-yellow-400 text-black text-[10px] font-bold px-1.5 rounded-full">{campaigns.length}</span>
            </button>
            <button onClick={() => setShowPixels(true)}
              className="flex items-center gap-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 rounded-full text-zinc-700 transition-colors cursor-pointer">
              <Database className="h-3.5 w-3.5" /> Pixels ({pixels.length})
            </button>
            <div className="flex items-center gap-2 border border-zinc-200 bg-zinc-50 p-1.5 pr-3 rounded-full">
              <div className="h-6 w-6 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">BC</div>
              <div className="text-[10px] leading-none">
                <span className="block font-bold text-zinc-900">Bruno Campos</span>
                <span className="text-[8px] bg-yellow-400/20 text-black border border-yellow-400/30 font-mono px-1.5 py-0.5 rounded uppercase mt-0.5 block font-extrabold">ADMIN</span>
              </div>
            </div>
          </div>
          <div className="pill hidden lg:flex"><span className="dot" />IA Ativa</div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
          <div className="relative h-28 w-28 flex items-center justify-center mb-8 bg-zinc-50 rounded-full border border-zinc-200">
            <div className="h-14 w-14 rounded-full bg-black flex items-center justify-center border-4 border-yellow-400 shadow-lg">
              <div className="h-5 w-5 rounded-full bg-yellow-400 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-black" />
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-10 max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-black uppercase">
              Como posso automatizar seus lances?
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Descreva o objetivo e a verba da sua campanha. O assistente IA da{" "}
              <span className="bg-yellow-400 px-1 text-black font-semibold font-mono">Pixel Roads</span>{" "}
              preenche os parâmetros programáticos automaticamente.
            </p>
          </div>

          <div className="w-full max-w-2xl bg-white border-2 border-zinc-200 hover:border-black focus-within:border-black focus-within:ring-2 focus-within:ring-yellow-400/50 rounded-3xl p-2.5 flex items-center gap-3 shadow-sm transition-all mb-8">
            <Sparkles className="h-5 w-5 text-zinc-300 ml-1 shrink-0" />
            <input type="text" placeholder="Descreva a campanha, verba ou público-alvo..."
              className="flex-1 bg-transparent text-sm border-none outline-none text-black placeholder-zinc-400 font-medium py-1"
              value={initPrompt} onChange={e => setInitPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && initPrompt.trim()) openWizard(initPrompt); }} />
            <button onClick={() => openWizard(initPrompt.trim() ? initPrompt : undefined)}
              className="p-3 bg-black hover:bg-zinc-800 text-yellow-400 rounded-full cursor-pointer transition-colors active:scale-95">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="w-full max-w-2xl">
            <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-3">Sugestões rápidas</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {[
                "R$ 5.000 para vendas na Grande São Paulo em Display",
                "Campanha de Awareness com lances automáticos de CPM",
                "Video pre-roll para engajamento no Rio de Janeiro",
              ].map((txt, i) => (
                <button key={i} onClick={() => { setInitPrompt(txt); openWizard(txt); }}
                  className="text-left text-xs bg-white hover:bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-2xl transition-all cursor-pointer text-zinc-700 flex items-center justify-between group shadow-sm">
                  <span>{txt}</span>
                  <ChevronRight className="h-3 w-3 text-zinc-300 group-hover:text-black transition-colors ml-2 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-100 w-full max-w-md">
            <button onClick={() => openWizard()}
              className="text-xs text-zinc-400 hover:text-black transition-colors flex items-center gap-1.5 justify-center mx-auto">
              <Layers className="h-4 w-4" />
              Montar campanha passo a passo manualmente
            </button>
          </div>
        </main>

        {renderModals()}
      </div>
    );
  }

  // ─── WIZARD VIEW ──────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-white font-sans overflow-hidden">
      <header className="a-topbar shrink-0">
        <button onClick={() => { setIsOpen(false); setForm(INITIAL_FORM); setMsgs([]); }}
          className="flex items-center gap-2 cursor-pointer focus:outline-none">
          <div className="h-8 w-8 rounded bg-black text-yellow-400 flex items-center justify-center font-black text-xs">PR</div>
          <div>
            <span className="text-sm font-black tracking-wider text-black uppercase flex items-center gap-1">
              Pixel Roads <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            </span>
            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Mídia Programática</p>
          </div>
        </button>
        <div className="flex items-center gap-3 ml-auto text-xs font-semibold">
          <button onClick={() => setShowCampaigns(true)}
            className="flex items-center gap-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 rounded-full text-zinc-700 transition-colors cursor-pointer">
            <History className="h-3.5 w-3.5" /> Campanhas <span className="bg-yellow-400 text-black text-[10px] font-bold px-1.5 rounded-full">{campaigns.length}</span>
          </button>
          <div className="flex items-center gap-2 border border-zinc-200 bg-zinc-50 p-1.5 pr-3 rounded-full">
            <div className="h-6 w-6 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">BC</div>
            <span className="text-[10px] font-bold text-zinc-900">Bruno Campos</span>
          </div>
        </div>
        <div className="pill hidden lg:flex"><span className="dot" />IA Ativa</div>
      </header>

      <div className="a-shell flex-1 min-h-0">
        <div className="a-chat">
          <div className="a-progress shrink-0">
            {Array.from({ length: 7 }, (_, i) => i + 1).map(n => (
              <div key={n} className={`step ${n < step ? "done" : n === step ? "current" : ""}`} title={STEP_NAMES[n]} />
            ))}
          </div>
          <div className="px-6 py-2 border-b border-zinc-100 flex items-center justify-between shrink-0">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
              {step <= 7 ? `Passo ${step} de 7 · ${STEP_NAMES[Math.min(step, 7)]}` : "Concluído"}
            </span>
            <button type="button" onClick={() => {
              if (confirm("Fechar o wizard? As alterações serão descartadas.")) {
                setIsOpen(false); setForm(INITIAL_FORM); setMsgs([]);
              }
            }} className="text-[10px] text-zinc-400 hover:text-black font-bold uppercase cursor-pointer">✕ Fechar</button>
          </div>

          <div className="a-msgs flex-1 min-h-0 overflow-y-auto">
            {msgs.map(renderMessage)}
            {aiLoading && (
              <div className="a-bubble ai w-full">
                <div className="a-aihead"><span className="ai-avatar">AI</span>Pixel Roads Intelligence<span className="why">Analisando...</span></div>
                <div className="a-typing"><span /><span /><span /></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="a-composer-zone shrink-0">
            <div className={`a-composer ${chatInput ? "has-grad" : ""}`}>
              <textarea placeholder="Pergunte ao assistente ou ajuste qualquer parâmetro..."
                value={chatInput} onChange={e => setChatInput(e.target.value)} rows={1}
                disabled={aiLoading}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} />
              <button type="button" onClick={sendChat} disabled={aiLoading || !chatInput.trim()}
                className={`a-comp-btn send ${chatInput.trim() ? "active" : ""}`}>
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="a-comp-hint">
              <span className="listen"><span className="pulse" />IA monitorando canais Pixel Roads</span>
              <span>Enter para enviar</span>
            </div>
          </div>
        </div>

        {sidebar}
      </div>

      {renderModals()}
      {adminAlert && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-white text-zinc-900 p-4 rounded-xl shadow-2xl border border-zinc-200 z-50 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-black shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase text-black">Notificação ADMIN</p>
            <p className="text-[11px] mt-0.5 text-zinc-600">{adminAlert}</p>
            <button onClick={() => setAdminAlert(null)} className="mt-1.5 text-[10px] font-bold text-black hover:underline block">Confirmar Ciência</button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── MODALS ───────────────────────────────────────────────────────────────
  function renderModals() {
    return (
      <>
        {showCampaigns && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-zinc-200 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
              <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 rounded-t-3xl">
                <span className="text-sm font-black text-black uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                  Campanhas Ativas ({campaigns.length})
                </span>
                <button onClick={() => setShowCampaigns(false)} className="text-xs font-bold text-zinc-500 hover:text-black px-2 py-1 hover:bg-zinc-200 rounded-lg cursor-pointer">✕ Fechar</button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <table className="w-full text-left text-xs text-zinc-700">
                  <thead className="text-[10px] uppercase text-zinc-400 tracking-wider border-b border-zinc-100">
                    <tr>{["Campanha", "Objetivo", "Período", "Verba", "Resultados", "Status"].map(h => <th key={h} className="p-3 font-black">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {campaigns.map(c => (
                      <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="p-3"><span className="block font-black text-black font-mono text-xs">{c.name}</span><span className="text-[10px] text-zinc-400">{c.advertiser}</span></td>
                        <td className="p-3"><span className="bg-yellow-400/20 text-black border border-yellow-400/30 px-2 py-0.5 rounded uppercase text-[10px] font-extrabold">{c.objective}</span></td>
                        <td className="p-3 text-zinc-500">{c.startDate} → {c.endDate}</td>
                        <td className="p-3 font-bold font-mono">R$ {c.budget.toLocaleString("pt-BR")}</td>
                        <td className="p-3">{c.clicks > 0 ? <><span className="block">{c.clicks.toLocaleString("pt-BR")} cliques</span><span className="text-zinc-400">{c.conversions.toLocaleString("pt-BR")} conv.</span></> : <span className="text-zinc-400 italic">Na fila</span>}</td>
                        <td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${c.status === "Ativo" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>{c.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-zinc-100 flex justify-between items-center bg-zinc-50 rounded-b-3xl">
                <span className="text-[11px] text-zinc-400 font-mono">AdsPlay Programmatic v4.0</span>
                <button onClick={() => { setShowCampaigns(false); openWizard(); }}
                  className="bg-black text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer hover:bg-zinc-800">+ Nova Campanha</button>
              </div>
            </div>
          </div>
        )}

        {showPixels && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-zinc-200 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
              <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 rounded-t-3xl">
                <span className="text-sm font-black text-black uppercase tracking-wider flex items-center gap-2">
                  <Database className="h-4 w-4" /> Pixels de Rastreamento ({pixels.length})
                </span>
                <button onClick={() => setShowPixels(false)} className="text-xs font-bold text-zinc-500 hover:text-black px-2 py-1 hover:bg-zinc-200 rounded-lg cursor-pointer">✕ Fechar</button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {pixels.map(px => (
                  <div key={px.id} className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-black text-black">{px.name}</h4>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold mt-0.5">{px.type === "conversion" ? "Conversão" : "Remarketing"}</p>
                      </div>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-black">Ativo</span>
                    </div>
                    <div className="bg-zinc-900 text-zinc-300 p-2.5 rounded text-[9px] font-mono whitespace-pre">
                      {px.type === "conversion"
                        ? `<!-- Pixel Roads Conversion -->\n<script>\n  pixelRoads.track('conversion');\n</script>`
                        : `<!-- Pixel Roads RMKT -->\n<script>\n  pixelRoads.populate('list');\n</script>`}
                    </div>
                    <p className="text-[10px] text-zinc-500">{px.installations} acionamentos rastreados</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}
