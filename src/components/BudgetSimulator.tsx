import { CheckCircle2, AlertTriangle, Calculator, TrendingUp } from "lucide-react";

interface BudgetSimulatorProps {
  totalBudget: number | "";
  startDate: string;
  endDate: string;
}

export function BudgetSimulator({ totalBudget, startDate, endDate }: BudgetSimulatorProps) {
  const calculateDays = (): number => {
    if (!startDate || !endDate) return 30;
    try {
      const parse = (s: string) => {
        const p = s.split("/");
        return p.length === 3 ? new Date(+p[2], +p[1] - 1, +p[0]) : new Date(s);
      };
      const diff = Math.ceil(Math.abs(parse(endDate).getTime() - parse(startDate).getTime()) / 86400000);
      return isNaN(diff) || diff === 0 ? 1 : diff;
    } catch {
      return 30;
    }
  };

  const days = calculateDays();
  const budget = Number(totalBudget) || 0;
  const daily = budget > 0 ? budget / days : 0;
  const ok = daily >= 10;
  const impressions = Math.round((budget / 12) * 1000);
  const clicks = Math.round(impressions * 0.0035);

  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 mt-3">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-100">
        <span className="text-[11px] font-bold text-zinc-700 flex items-center gap-1.5 uppercase tracking-wide">
          <Calculator className="h-3.5 w-3.5" /> Simulador de Verba
        </span>
        <span className="text-[10px] bg-white text-zinc-500 border border-zinc-200 px-2 py-0.5 rounded-full font-mono">{days} dias</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg p-3 border border-zinc-200">
          <p className="text-[10px] text-zinc-400 font-bold uppercase">Diário</p>
          <p className="text-base font-black text-black font-mono mt-0.5">
            R$ {daily.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {budget > 0 && (
            ok
              ? <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold mt-1"><CheckCircle2 className="h-3 w-3" /> Dentro do mínimo</span>
              : <span className="text-[10px] text-amber-600 flex items-center gap-1 font-semibold mt-1"><AlertTriangle className="h-3 w-3" /> Abaixo de R$10/dia</span>
          )}
        </div>
        <div className="bg-yellow-400/10 rounded-lg p-3 border border-yellow-400/30">
          <p className="text-[10px] text-zinc-700 font-bold uppercase flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Estimativa</p>
          {budget > 0 ? (
            <div className="mt-1 space-y-0.5 text-xs">
              <div className="flex justify-between"><span className="text-zinc-500">Impressões:</span><span className="font-bold font-mono">{impressions.toLocaleString("pt-BR")}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Cliques:</span><span className="font-bold font-mono">{clicks.toLocaleString("pt-BR")}</span></div>
            </div>
          ) : <p className="text-[11px] text-zinc-400 mt-1">Defina o orçamento</p>}
        </div>
      </div>
      {budget > 0 && days < 7 && (
        <p className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-[10px]">
          <AlertTriangle className="h-3 w-3 inline mr-1" />Recomendamos no mínimo <strong>7 dias</strong>. O ideal são 30 dias para otimização do algoritmo.
        </p>
      )}
    </div>
  );
}
