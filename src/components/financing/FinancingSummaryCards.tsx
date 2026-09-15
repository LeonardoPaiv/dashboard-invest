import React from 'react';
import { FinancingSummary, FinancingComparison } from '../../types/financing';
import { DollarSign, Clock, TrendingDown, Percent, ShieldCheck, AlertTriangle } from 'lucide-react';

interface Props {
  summary: FinancingSummary;
  comparison?: FinancingComparison;
  isExtraEnabled: boolean;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

export const FinancingSummaryCards: React.FC<Props> = ({ summary, comparison, isExtraEnabled }) => {
  const years = (summary.actualMonthsToPayoff / 12).toFixed(1);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {/* 1ª Parcela */}
      <div className="bg-card border border-white/10 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition-all">
        <div className="flex items-center justify-between text-white/40 mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider">1ª Parcela (Encargo)</span>
          <DollarSign size={16} className="text-primary" />
        </div>
        <div>
          <div className="text-xl font-black text-white tracking-tight">
            {formatCurrency(summary.firstInstallment)}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            {summary.isIncomeCommitmentOk ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck size={11} /> {summary.incomeCommitmentPercent.toFixed(1)}% da renda
              </span>
            ) : (
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={11} /> {summary.incomeCommitmentPercent.toFixed(1)}% (&gt; 30% máx)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Última Parcela */}
      <div className="bg-card border border-white/10 rounded-2xl p-4 flex flex-col justify-between group hover:border-white/20 transition-all">
        <div className="flex items-center justify-between text-white/40 mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider">Última Parcela</span>
          <TrendingDown size={16} className="text-secondary" />
        </div>
        <div>
          <div className="text-xl font-black text-white tracking-tight">
            {formatCurrency(summary.lastInstallment)}
          </div>
          <span className="text-[10px] text-white/40 mt-1 block">
            Mês {summary.actualMonthsToPayoff} de {summary.originalMonths}
          </span>
        </div>
      </div>

      {/* Prazo Real e Economia */}
      <div className="bg-card border border-white/10 rounded-2xl p-4 flex flex-col justify-between group hover:border-white/20 transition-all">
        <div className="flex items-center justify-between text-white/40 mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider">Prazo Real Quitação</span>
          <Clock size={16} className="text-amber-400" />
        </div>
        <div>
          <div className="text-xl font-black text-white tracking-tight">
            {summary.actualMonthsToPayoff} meses
          </div>
          <div className="mt-1">
            {isExtraEnabled && comparison && comparison.monthsSaved > 0 ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">
                -{comparison.monthsSaved} meses (~{(comparison.monthsSaved / 12).toFixed(1)} anos)
              </span>
            ) : (
              <span className="text-[10px] text-white/40">
                {years} anos contratuais
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Total de Juros Pagos */}
      <div className="bg-card border border-white/10 rounded-2xl p-4 flex flex-col justify-between group hover:border-white/20 transition-all">
        <div className="flex items-center justify-between text-white/40 mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider">Total em Juros</span>
          <Percent size={16} className="text-rose-400" />
        </div>
        <div>
          <div className="text-xl font-black text-rose-400 tracking-tight">
            {formatCurrency(summary.totalInterest)}
          </div>
          <div className="mt-1">
            {isExtraEnabled && comparison && comparison.interestSaved > 0 ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">
                Economia: {formatCurrency(comparison.interestSaved)}
              </span>
            ) : (
              <span className="text-[10px] text-white/40">
                Taxa efetiva: {summary.effectiveAnnualRate.toFixed(2)}% a.a.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Custo Total Final Desembolsado */}
      <div className="bg-card border border-white/10 rounded-2xl p-4 flex flex-col justify-between group hover:border-white/20 transition-all">
        <div className="flex items-center justify-between text-white/40 mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider">Custo Total Pago</span>
          <DollarSign size={16} className="text-sky-400" />
        </div>
        <div>
          <div className="text-xl font-black text-white tracking-tight">
            {formatCurrency(summary.totalPaid)}
          </div>
          <div className="mt-1">
            {isExtraEnabled && comparison && comparison.totalSaved > 0 ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">
                Poupado: {formatCurrency(comparison.totalSaved)}
              </span>
            ) : (
              <span className="text-[10px] text-white/40">
                LTV: {summary.ltv.toFixed(1)}% do imóvel
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Renda Mínima Exigida */}
      <div className="bg-card border border-white/10 rounded-2xl p-4 flex flex-col justify-between group hover:border-white/20 transition-all">
        <div className="flex items-center justify-between text-white/40 mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider">Renda Mínima Sugerida</span>
          <ShieldCheck size={16} className="text-emerald-400" />
        </div>
        <div>
          <div className="text-xl font-black text-white tracking-tight">
            {formatCurrency(summary.minGrossIncomeRequired)}
          </div>
          <span className="text-[10px] text-white/40 mt-1 block">
            Base legal de 30% da renda
          </span>
        </div>
      </div>
    </div>
  );
};
