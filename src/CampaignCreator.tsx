import { useState, useEffect, useRef } from "react";
import {
  Sparkles, Globe, ArrowRight, ArrowLeft, Check, AlertTriangle,
  Lightbulb, Rocket, Loader2, Pencil, HelpCircle, X,
} from "lucide-react";
import {
  analyze, estimate, fmtBRL, fmtNum, hasGemini, PLAYBOOKS, GOAL_META,
  type Reading, type Goal, type Confidence,
} from "./brain";

// ─── Dados da plataforma (mock — trocar por API da Pixel Roads) ──────────────

const ADVERTISERS = [
  { id: "adv-1", name: "AdsPlay Media Group" },
  { id: "adv-2", name: "Pixel Roads Demo Store" },
  { id: "adv-3", name: "Bradesco Digital" },
];
const STATES = [
  { id: "sp", label: "São Paulo", short: "SP" },
  { id: "rj", label: "Rio de Janeiro", short: "RJ" },
  { id: "mg", label: "Minas Gerais", short: "MG" },
  { id: "rs", label: "Rio Grande do Sul", short: "RS" },
  { id: "pr", label: "Paraná", short: "PR" },
  { id: "sc", label: "Santa Catarina", short: "SC" },
  { id: "ba", label: "Bahia", short: "BA" },
  { id: "df", label: "Distrito Federal", short: "DF" },
];
const AUDIENCES = [
  "Todos os usuários", "Jovens adultos (18–34)", "Adultos (35–54)",
  "Alta renda", "Classe média", "Interessados em moda",
  "Compradores recentes", "Abandono de carrinho",
];
const CREATIVES = [
  { id: "cr-1", name: "Banner Principal", size: "300×250", kind: "display" },
  { id: "cr-2", name: "Leaderboard", size: "728×90", kind: "display" },
  { id: "cr-3", name: "Half Page", size: "300×600", kind: "display" },
  { id: "cr-4", name: "Vídeo 15s", size: "1920×1080", kind: "video" },
  { id: "cr-5", name: "Vídeo 30s", size: "1920×1080", kind: "video" },
];
const PIXELS = [
  { id: "px-1", name: "Pixel de Conversão", desc: "Mede vendas e ações no site" },
  { id: "px-2", name: "Pixel de Retargeting", desc: "Monta público de quem visitou" },
];

// ─── Form ────────────────────────────────────────────────────────────────────

interface Form {
  advertiserId: string;
  goal: Goal;
  name: string;
  startDate: string;
  endDate: string;
  budget: number;
  pacing: "diario" | "total";
  bidType: "CPM" | "CPC" | "CPV";
  bidAuto: boolean;
  bidValue: number;
  freqCap: number;
  states: string[];
  audiences: string[];
  creatives: string[];
  pixels: string[];
  skipPixel: boolean;
}

const STEPS = [
  { n: 1, title: "Objetivo" },
  { n: 2, title: "Verba e período" },
  { n: 3, title: "Lances" },
  { n: 4, title: "Público" },
  { n: 5, title: "Criativos" },
  { n: 6, title: "Rastreamento" },
  { n: 7, title: "Revisão" },
];

function formFromReading(r: Reading): Form {
  const pb = PLAYBOOKS[r.vertical];
  const wantsVideo = pb.id === "food" || pb.id === "app";
  return {
    advertiserId: ADVERTISERS[0].id,
    goal: r.goal,
    name: `${pb.label} — ${GOAL_META[r.goal].label}`,
    startDate: r.startDate,
    endDate: r.endDate,
    budget: r.budget,
    pacing: "diario",
    bidType: r.goal === "CONVERSAO" ? "CPC" : "CPM",
    bidAuto: true,
    bidValue: r.goal === "CONVERSAO" ? pb.refCpc : pb.refCpm,
    freqCap: r.goal === "AWARENESS" ? 5 : 3,
    states: pb.id === "food" ? ["sp"] : ["sp", "rj"],
    audiences: pb.audiences.slice(0, 2),
    creatives: wantsVideo ? ["cr-4", "cr-1"] : ["cr-1", "cr-2"],
    pixels: r.goal === "CONVERSAO" ? ["px-1"] : [],
    skipPixel: r.goal !== "CONVERSAO",
  };
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function ConfBadge({ c }: { c: Confidence }) {
  const map = {
    detectado: { t: "você disse", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    sugerido: { t: "eu sugeri", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    nao_informado: { t: "em aberto", cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  };
  const m = map[c];
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.cls}`}>{m.t}</span>;
}

function AiHead({ children, why }: { children: React.ReactNode; why?: string }) {
  return (
    <div className="a-aihead">
      <span className="ai-avatar"><Sparkles size={11} /></span>
      {children}
      {why && <span className="why">{why}</span>}
    </div>
  );
}

/** Nota obrigatória sempre que um número estimado aparece na tela. */
function EstimateNote() {
  return (
    <p className="text-[10px] text-zinc-400 leading-snug mt-2 flex items-start gap-1">
      <HelpCircle size={11} className="shrink-0 mt-px" />
      Estimativa com CPM de referência do mockup — não é previsão de entrega real.
      O time precisa trocar por dado histórico da Pixel Roads.
    </p>
  );
}

// ─── Tela 1: Briefing ────────────────────────────────────────────────────────

const EXAMPLES = [
  "Tenho uma loja de moda feminina em São Paulo, quero vender mais no Natal. Verba de R$ 40 mil.",
  "App de delivery novo, preciso que as pessoas conheçam a marca em SP e RJ. R$ 25k para 60 dias.",
  "Conta digital para público de alta renda, foco em abertura de conta. Invisto R$ 80 mil.",
];

function Briefing({ onSubmit }: { onSubmit: (text: string, url: string) => void }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const ready = text.trim().length > 15;
  const send = () => { if (ready) onSubmit(text.trim(), url.trim()); };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center text-yellow-400 font-black mx-auto mb-5">PR</div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Vamos montar sua campanha</h1>
          <p className="text-sm text-zinc-500 leading-relaxed max-w-md mx-auto">
            Me conta o que você vende, o que quer conseguir e quanto pode investir.
            Eu estruturo o resto como um head de mídia faria.
          </p>
        </div>

        <div className="a-composer has-grad" style={{ borderRadius: 18, padding: 0, flexDirection: "column", alignItems: "stretch" }}>
          <textarea
            ref={ref}
            rows={5}
            className="w-full px-5 py-4 text-sm bg-transparent border-none outline-none resize-none leading-relaxed"
            placeholder={"Escreva do seu jeito, sem formalidade.\n\nEx: Tenho uma loja de roupa feminina, quero vender mais no fim do ano e tenho uns 30 mil para investir."}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
          />

          {showUrl && (
            <div className="px-5 pb-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
              <Globe size={14} className="text-zinc-400 shrink-0" />
              <input
                autoFocus
                className="flex-1 text-sm bg-transparent border-none outline-none"
                placeholder="site-do-cliente.com.br"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") send(); }}
              />
              <button onClick={() => { setShowUrl(false); setUrl(""); }} className="text-zinc-300 hover:text-zinc-600">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100">
            {!showUrl ? (
              <button onClick={() => setShowUrl(true)} className="text-xs text-zinc-500 hover:text-black flex items-center gap-1.5">
                <Globe size={13} /> Tem site? Eu leio e uso no plano
              </button>
            ) : (
              <span className="text-[11px] text-zinc-400">Vou ler o site antes de montar</span>
            )}
            <button
              onClick={send}
              disabled={!ready}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl transition-all ${
                ready ? "bg-black text-white hover:bg-zinc-800" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
              }`}
            >
              Analisar <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2.5">Ou comece por um exemplo</p>
          <div className="flex flex-col gap-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setText(ex)}
                className="text-left text-xs text-zinc-600 px-4 py-2.5 rounded-xl border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 transition-all"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {!hasGemini && (
          <p className="text-[11px] text-zinc-400 text-center mt-8 leading-relaxed">
            Rodando com análise local. Para ativar o Gemini, defina{" "}
            <code className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded">VITE_GEMINI_API_KEY</code> no .env
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Tela 2: Análise ─────────────────────────────────────────────────────────

const THINKING = [
  "Lendo seu briefing",
  "Identificando o tipo de negócio",
  "Consultando o playbook da vertical",
  "Checando sazonalidade do período",
  "Montando a estratégia",
];

function Analysis({
  text, url, onConfirm, onBack,
}: { text: string; url: string; onConfirm: (r: Reading) => void; onBack: () => void }) {
  const [reading, setReading] = useState<Reading | null>(null);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let alive = true;
    const timer = setInterval(() => setStage(s => Math.min(s + 1, THINKING.length - 1)), 700);
    analyze(text, url).then(r => {
      if (!alive) return;
      clearInterval(timer);
      setReading(r);
    });
    return () => { alive = false; clearInterval(timer); };
  }, [text, url]);

  if (!reading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-zinc-300" size={26} />
          <div className="space-y-1.5">
            {THINKING.slice(0, stage + 1).map((t, i) => (
              <p key={i} className={`text-xs ${i === stage ? "text-zinc-900 font-medium" : "text-zinc-400"}`}>
                {i < stage && <Check size={11} className="inline mr-1.5 text-emerald-500" />}
                {t}{i === stage ? "…" : ""}
              </p>
            ))}
          </div>
          {url && <p className="text-[11px] text-zinc-400 mt-4">Lendo {url}</p>}
        </div>
      </div>
    );
  }

  const pb = PLAYBOOKS[reading.vertical];
  const est = estimate(reading.budget, pb);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">

        {/* O que entendi */}
        <div className="a-bubble ai">
          <AiHead why={reading.source === "gemini" ? "Gemini" : "análise local"}>ENTENDI O SEGUINTE</AiHead>
          <p className="font-medium mb-4">{reading.business}</p>

          <div className="space-y-2.5">
            <Row label="Tipo de negócio" conf={reading.verticalConfidence}>
              {pb.icon} {pb.label}
            </Row>
            <Row label="Objetivo" conf={reading.goalConfidence}>
              {GOAL_META[reading.goal].icon} {GOAL_META[reading.goal].label}
            </Row>
            <Row label="Verba" conf={reading.budgetConfidence}>
              {fmtBRL(reading.budget)}
            </Row>
            <Row label="Período" conf={reading.periodConfidence}>
              {reading.periodLabel}
            </Row>
          </div>
        </div>

        {/* Tradutor de verba */}
        <div className="a-bubble ai">
          <AiHead>O QUE SUA VERBA COMPRA</AiHead>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="rounded-xl border border-zinc-200 p-3.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold mb-1">Impressões</p>
              <p className="text-xl font-bold tabular-nums">{fmtNum(est.impressions)}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">pessoas veem o anúncio</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-3.5">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold mb-1">Cliques</p>
              <p className="text-xl font-bold tabular-nums">{fmtNum(est.clicks)}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">visitas ao seu site</p>
            </div>
          </div>
          <EstimateNote />
        </div>

        {/* Alerta de sazonalidade */}
        {reading.seasonAlert && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900 mb-0.5">Atenção ao período</p>
              <p className="text-xs text-amber-800 leading-relaxed">{reading.seasonAlert}</p>
            </div>
          </div>
        )}

        {/* O que eu faria além */}
        <div className="a-bubble ai">
          <AiHead why="além do briefing">O QUE EU FARIA NO SEU LUGAR</AiHead>
          <div className="space-y-3 mt-1">
            {reading.plays.map((p, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-base leading-none mt-0.5">{p.icon}</span>
                <div>
                  <p className="text-[13px] font-semibold">{p.title}</p>
                  <p className="text-xs text-zinc-600 leading-relaxed mt-0.5">{p.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pontos em aberto */}
        {reading.gaps.length > 0 && (
          <div className="a-bubble ai">
            <AiHead>PONTOS QUE FICARAM EM ABERTO</AiHead>
            <ul className="space-y-2 mt-1">
              {reading.gaps.map((g, i) => (
                <li key={i} className="text-xs text-zinc-600 leading-relaxed flex gap-2.5">
                  <Lightbulb size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 pt-2 pb-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-black px-4 py-2.5 rounded-xl border border-zinc-200">
            <ArrowLeft size={14} /> Reescrever briefing
          </button>
          <button
            onClick={() => onConfirm(reading)}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-black hover:bg-zinc-800 px-5 py-2.5 rounded-xl transition-colors"
          >
            Montar campanha com isso <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, conf, children }: { label: string; conf: Confidence; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-zinc-200 last:border-0">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500 font-semibold">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-[13px] font-medium">{children}</span>
        <ConfBadge c={conf} />
      </span>
    </div>
  );
}

// ─── Tela 3: Wizard ──────────────────────────────────────────────────────────

function Wizard({ reading, initial, onDone }: { reading: Reading; initial: Form; onDone: (f: Form) => void }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState<Form>(initial);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { scroller.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const pb = PLAYBOOKS[reading.vertical];
  const est = estimate(f.budget, pb);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }));
  const toggle = (k: "states" | "audiences" | "creatives" | "pixels", v: string) =>
    setF(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }));

  const next = () => (step < 7 ? setStep(step + 1) : onDone(f));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="a-progress">
        {STEPS.map(s => (
          <div key={s.n} className={`step ${s.n < step ? "done" : s.n === step ? "current" : ""}`} />
        ))}
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-4">
            Passo {step} de 7 · {STEPS[step - 1].title}
          </p>

          {step === 1 && (
            <StepCard title="Seu objetivo" why={reading.goalConfidence === "detectado" ? "você disse isso" : "sugestão minha"}
              note={`Marquei ${GOAL_META[f.goal].label} porque foi o que li do seu briefing. Se estiver errado, troque — isso muda todo o resto da campanha.`}>
              <div className="grid grid-cols-2 gap-2.5">
                {(Object.keys(GOAL_META) as Goal[]).map(g => (
                  <button key={g} onClick={() => set("goal", g)} className={`a-card-opt ${f.goal === g ? "sel" : ""}`}>
                    <span className="label">{GOAL_META[g].icon} {GOAL_META[g].label}</span>
                    <span className="desc">{GOAL_META[g].desc}</span>
                  </button>
                ))}
              </div>
              <div className="a-field mt-4">
                <label>Anunciante</label>
                <select value={f.advertiserId} onChange={e => set("advertiserId", e.target.value)}>
                  {ADVERTISERS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </StepCard>
          )}

          {step === 2 && (
            <StepCard title="Verba e período" why={reading.budgetConfidence === "detectado" ? "verba que você disse" : "ponto de partida"}
              note={reading.periodLabel}>
              <div className="a-field mb-3">
                <label>Nome da campanha</label>
                <input value={f.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="a-field-grid mb-3">
                <div className="a-field">
                  <label>Início</label>
                  <input type="date" value={f.startDate} onChange={e => set("startDate", e.target.value)} />
                </div>
                <div className="a-field">
                  <label>Fim</label>
                  <input type="date" value={f.endDate} onChange={e => set("endDate", e.target.value)} />
                </div>
              </div>
              <div className="a-field mb-3">
                <label>Verba total (R$)</label>
                <input type="number" value={f.budget} onChange={e => set("budget", Number(e.target.value))} />
              </div>

              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5">
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  Com <strong>{fmtBRL(f.budget)}</strong> você deve alcançar cerca de{" "}
                  <strong className="tabular-nums">{fmtNum(est.impressions)}</strong> impressões
                  e <strong className="tabular-nums">{fmtNum(est.clicks)}</strong> cliques.
                </p>
                <EstimateNote />
              </div>

              <div className="mt-3">
                <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 block mb-1.5">Distribuição</label>
                <div className="a-toggle-row">
                  <button className={`a-toggle ${f.pacing === "diario" ? "on" : ""}`} onClick={() => set("pacing", "diario")}>
                    Diluir por dia
                  </button>
                  <button className={`a-toggle ${f.pacing === "total" ? "on" : ""}`} onClick={() => set("pacing", "total")}>
                    Gastar o quanto puder
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
                  Diluir por dia mantém a campanha no ar o período inteiro. É o mais seguro para quem está começando.
                </p>
              </div>
            </StepCard>
          )}

          {step === 3 && (
            <StepCard title="Como você paga" why="recomendação"
              note={f.goal === "CONVERSAO"
                ? "Para venda, CPC faz mais sentido: você paga por quem clicou, não por quem só viu."
                : "Para reconhecimento, CPM entrega mais gente pelo mesmo dinheiro. Você paga por exibição."}>
              <div className="a-toggle-row mb-4">
                {(["CPM", "CPC", "CPV"] as const).map(b => (
                  <button key={b} className={`a-toggle ${f.bidType === b ? "on" : ""}`} onClick={() => set("bidType", b)}>
                    {b === "CPM" ? "Por exibição" : b === "CPC" ? "Por clique" : "Por vídeo visto"}
                    <span className="block text-[9px] font-mono opacity-60 mt-0.5">{b}</span>
                  </button>
                ))}
              </div>

              <div className="a-toggle-row mb-3">
                <button className={`a-toggle ${f.bidAuto ? "on" : ""}`} onClick={() => set("bidAuto", true)}>
                  Deixar a plataforma decidir
                </button>
                <button className={`a-toggle ${!f.bidAuto ? "on" : ""}`} onClick={() => set("bidAuto", false)}>
                  Definir eu mesmo
                </button>
              </div>

              {!f.bidAuto && (
                <div className="a-field mb-3">
                  <label>Lance máximo (R$)</label>
                  <input type="number" step="0.1" value={f.bidValue} onChange={e => set("bidValue", Number(e.target.value))} />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Valor de referência do mockup para {pb.label}: {fmtBRL(f.bidType === "CPC" ? pb.refCpc : pb.refCpm)}.
                    Substituir por lance real da plataforma.
                  </p>
                </div>
              )}

              <div className="a-field">
                <label>Quantas vezes a mesma pessoa vê por dia</label>
                <input type="number" min={1} max={20} value={f.freqCap} onChange={e => set("freqCap", Number(e.target.value))} />
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  {f.goal === "AWARENESS"
                    ? "Marca nova precisa de repetição para fixar. Deixei em 5."
                    : "Acima de 3 a 4 exibições no mesmo dia começa a incomodar sem trazer resultado."}
                </p>
              </div>
            </StepCard>
          )}

          {step === 4 && (
            <StepCard title="Quem vai ver" why="do playbook"
              note={pb.id === "food"
                ? "Delivery só entrega onde entrega. Apertei a praça de propósito — rodar no país inteiro queima verba em quem não pode pedir."
                : `Comecei por ${f.states.length} praça(s) e ${f.audiences.length} público(s). Concentrar gera aprendizado mais rápido que espalhar.`}>
              <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 block mb-2">Onde anunciar</label>
              <div className="a-chip-list mb-5">
                {STATES.map(s => (
                  <button key={s.id} className={`a-chip ${f.states.includes(s.id) ? "sel" : ""}`} onClick={() => toggle("states", s.id)}>
                    {f.states.includes(s.id) && <Check size={11} />} {s.label}
                  </button>
                ))}
              </div>

              <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 block mb-2">Perfil de público</label>
              <div className="a-chip-list">
                {AUDIENCES.map(a => (
                  <button key={a} className={`a-chip ${f.audiences.includes(a) ? "sel" : ""}`} onClick={() => toggle("audiences", a)}>
                    {f.audiences.includes(a) && <Check size={11} />} {a}
                  </button>
                ))}
              </div>
            </StepCard>
          )}

          {step === 5 && (
            <StepCard title="Suas peças" why="do playbook" note={pb.creativeHint}>
              <div className="flex flex-col gap-2">
                {CREATIVES.map(c => (
                  <button key={c.id} className={`a-list-row ${f.creatives.includes(c.id) ? "sel" : ""}`} onClick={() => toggle("creatives", c.id)}>
                    <span className="ava">{c.kind === "video" ? "🎬" : "🖼️"}</span>
                    <span className="meta">
                      <span className="n">{c.name}</span>
                      <span className="s">{c.size} · {c.kind === "video" ? "Vídeo" : "Display"}</span>
                    </span>
                    {f.creatives.includes(c.id) && <Check size={15} className="check text-emerald-600" />}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
                Usar mais de um formato amplia onde o anúncio pode aparecer. Só um formato limita o inventário disponível.
              </p>
            </StepCard>
          )}

          {step === 6 && (
            <StepCard title="Medir o resultado" why={f.goal === "CONVERSAO" ? "obrigatório aqui" : "recomendado"}
              note={f.goal === "CONVERSAO"
                ? "Você quer venda. Sem pixel instalado eu não consigo te dizer quantas vendas a campanha gerou — nem montar retargeting depois."
                : "Mesmo em campanha de marca, o pixel monta o público de quem visitou. Isso vira ouro na próxima campanha."}>
              <div className="flex flex-col gap-2 mb-4">
                {PIXELS.map(p => (
                  <button key={p.id} className={`a-list-row ${f.pixels.includes(p.id) ? "sel" : ""}`}
                    onClick={() => { toggle("pixels", p.id); set("skipPixel", false); }}>
                    <span className="ava">🎯</span>
                    <span className="meta">
                      <span className="n">{p.name}</span>
                      <span className="s">{p.desc}</span>
                    </span>
                    {f.pixels.includes(p.id) && <Check size={15} className="check text-emerald-600" />}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { set("skipPixel", !f.skipPixel); set("pixels", []); }}
                className={`text-xs px-4 py-2 rounded-xl border transition-all ${
                  f.skipPixel ? "border-zinc-400 bg-zinc-50 text-zinc-700 font-medium" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"
                }`}
              >
                Seguir sem pixel por enquanto
              </button>
              {f.skipPixel && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-3 leading-relaxed">
                  Sem pixel a campanha roda, mas você fica sem saber o que ela gerou de verdade. Dá para instalar depois.
                </p>
              )}
            </StepCard>
          )}

          {step === 7 && (
            <StepCard title="Tudo pronto" why="confira antes de subir"
              note="Dei uma olhada geral e está coerente. Confere os pontos abaixo e pode subir.">
              <div className="rounded-xl border border-zinc-200 divide-y divide-dashed divide-zinc-200">
                <Sum k="Anunciante" v={ADVERTISERS.find(a => a.id === f.advertiserId)?.name || "—"} />
                <Sum k="Campanha" v={f.name} />
                <Sum k="Objetivo" v={`${GOAL_META[f.goal].icon} ${GOAL_META[f.goal].label}`} />
                <Sum k="Período" v={`${f.startDate} → ${f.endDate}`} />
                <Sum k="Verba" v={fmtBRL(f.budget)} />
                <Sum k="Modelo" v={`${f.bidType}${f.bidAuto ? " automático" : ` · ${fmtBRL(f.bidValue)}`}`} />
                <Sum k="Frequência" v={`até ${f.freqCap}× por dia`} />
                <Sum k="Praças" v={f.states.map(s => STATES.find(x => x.id === s)?.short).join(", ") || "—"} />
                <Sum k="Públicos" v={f.audiences.join(", ") || "—"} />
                <Sum k="Criativos" v={`${f.creatives.length} peça(s)`} />
                <Sum k="Rastreamento" v={f.skipPixel ? "sem pixel" : `${f.pixels.length} pixel(s)`} />
              </div>

              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5 mt-3">
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  Projeção: <strong className="tabular-nums">{fmtNum(est.impressions)}</strong> impressões
                  e <strong className="tabular-nums">{fmtNum(est.clicks)}</strong> cliques.
                </p>
                <EstimateNote />
              </div>
            </StepCard>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-200 bg-white px-6 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-black px-3.5 py-2.5 rounded-xl border border-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={14} /> Voltar
          </button>
          <button
            onClick={next}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-black hover:bg-zinc-800 px-5 py-2.5 rounded-xl transition-colors"
          >
            {step === 7 ? <>Subir campanha <Rocket size={15} /></> : <>Confirmar e seguir <ArrowRight size={15} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepCard({ title, why, note, children }: { title: string; why: string; note: string; children: React.ReactNode }) {
  return (
    <>
      <div className="a-bubble ai step-card mb-4">
        <AiHead why={why}>{title.toUpperCase()}</AiHead>
        <p className="text-[13px] text-zinc-700 leading-relaxed">{note}</p>
      </div>
      <div>{children}</div>
    </>
  );
}

function Sum({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 px-3.5 py-2.5">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500 font-semibold shrink-0">{k}</span>
      <span className="text-[12px] font-medium text-right">{v}</span>
    </div>
  );
}

// ─── Tela 4: Sucesso ─────────────────────────────────────────────────────────

function Success({ f, onNew }: { f: Form; onNew: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-5">
          <Check size={24} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">Campanha no ar</h2>
        <p className="text-sm text-zinc-500 leading-relaxed mb-6">
          <strong className="text-zinc-900">{f.name}</strong> foi criada com {fmtBRL(f.budget)}
          {" "}e começa a rodar em {f.startDate}.
        </p>

        <div className="rounded-xl border border-zinc-200 p-4 text-left mb-6">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2.5">Próximos passos</p>
          <ul className="space-y-2 text-xs text-zinc-600">
            <li className="flex gap-2"><span className="text-zinc-300">1.</span> Deixe rodar de 3 a 5 dias antes de mexer em lance ou público.</li>
            <li className="flex gap-2"><span className="text-zinc-300">2.</span> {f.skipPixel ? "Instale o pixel para conseguir medir conversão." : "Acompanhe as conversões pelo pixel já instalado."}</li>
            <li className="flex gap-2"><span className="text-zinc-300">3.</span> Se um criativo destacar, redistribua verba para ele.</li>
          </ul>
        </div>

        <button onClick={onNew} className="text-sm font-semibold text-white bg-black hover:bg-zinc-800 px-5 py-2.5 rounded-xl">
          Criar outra campanha
        </button>
      </div>
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

type Screen = "briefing" | "analysis" | "wizard" | "done";

export default function CampaignCreator() {
  const [screen, setScreen] = useState<Screen>("briefing");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);
  const [form, setForm] = useState<Form | null>(null);

  const reset = () => { setScreen("briefing"); setText(""); setUrl(""); setReading(null); setForm(null); };

  const titles: Record<Screen, string> = {
    briefing: "Pixel Roads",
    analysis: "Lendo seu briefing",
    wizard: "Montando a campanha",
    done: "Campanha criada",
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="a-topbar shrink-0">
        <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center text-[10px] font-black text-yellow-400 shrink-0">PR</div>
        <span className="text-sm font-semibold">{titles[screen]}</span>
        <div className="pill"><span className="dot" />{hasGemini ? "IA ativa" : "IA local"}</div>
        {screen !== "briefing" && (
          <button onClick={reset} className="text-xs text-zinc-400 hover:text-black border border-zinc-200 rounded-lg px-3 py-1.5 ml-3">
            Recomeçar
          </button>
        )}
      </div>

      {screen === "briefing" && (
        <Briefing onSubmit={(t, u) => { setText(t); setUrl(u); setScreen("analysis"); }} />
      )}
      {screen === "analysis" && (
        <Analysis
          text={text}
          url={url}
          onBack={() => setScreen("briefing")}
          onConfirm={r => { setReading(r); setForm(formFromReading(r)); setScreen("wizard"); }}
        />
      )}
      {screen === "wizard" && reading && form && (
        <Wizard reading={reading} initial={form} onDone={f => { setForm(f); setScreen("done"); }} />
      )}
      {screen === "done" && form && <Success f={form} onNew={reset} />}
    </div>
  );
}
