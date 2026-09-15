import React, { useMemo } from 'react';
import { FinancingParameters } from '../../types/financing';
import { simulateFinancing } from '../../utils/financingEngine';
import { X, Scale, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  params: FinancingParameters;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
};

export const SacPriceComparisonModal: React.FC<Props> = ({ isOpen, onClose, params }) => {
  const comparison = useMemo(() => {
    if (!isOpen) return null;
    const sacParams = { ...params, amortizationType: 'SAC' as const };
    const priceParams = { ...params, amortizationType: 'PRICE' as const };

    const sacRes = simulateFinancing(sacParams);
    const priceRes = simulateFinancing(priceParams);

    const sacSum = sacRes.summary;
    const priceSum = priceRes.summary;

    const diffFirstInstallment = priceSum.firstInstallment - sacSum.firstInstallment;
    const diffTotalInterest = priceSum.totalInterest - sacSum.totalInterest;
    const diffTotalPaid = priceSum.totalPaid - sacSum.totalPaid;
    const diffMinIncome = priceSum.minGrossIncomeRequired - sacSum.minGrossIncomeRequired;

    return {
      sacRes,
      priceRes,
      sacSum,
      priceSum,
      diffFirstInstallment,
      diffTotalInterest,
      diffTotalPaid,
      diffMinIncome
    };
  }, [isOpen, params]);

  if (!isOpen || !comparison) return null;

  const { sacRes, priceRes, sacSum, priceSum, diffFirstInstallment, diffTotalInterest, diffTotalPaid, diffMinIncome } = comparison;

  const sacInst1 = sacRes.installments[0];
  const priceInst1 = priceRes.installments[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-card border border-white/10 rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 text-primary">
              <Scale size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Comparativo Direto: SAC vs Tabela Price</h3>
              <p className="text-xs text-white/40">
                Confronto analítico para o financiamento de {formatCurrency(sacSum.financedAmount)} em {params.termMonths} meses ({((params.termMonths / 12)).toFixed(0)} anos)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Highlight Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 size={14} /> Vantagem do SAC: Economia em Juros
            </div>
            <p className="text-sm text-white font-bold">
              Você economiza {formatCurrency(Math.abs(diffTotalInterest))} no total em relação à Price ({((Math.abs(diffTotalInterest) / priceSum.totalInterest) * 100).toFixed(1)}% a menos).
            </p>
            <p className="text-xs text-white/60">
              A amortização inicial no SAC é maior ({formatCurrency(sacInst1?.regularAmortization || 0)} vs {formatCurrency(priceInst1?.regularAmortization || 0)}), reduzindo o saldo devedor mais rapidamente.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 size={14} /> Vantagem da Price: Parcela Inicial Acessível
            </div>
            <p className="text-sm text-white font-bold">
              Primeira parcela {formatCurrency(Math.abs(diffFirstInstallment))} mais baixa ({((Math.abs(diffFirstInstallment) / sacSum.firstInstallment) * 100).toFixed(1)}% menor).
            </p>
            <p className="text-xs text-white/60">
              Reduz a exigência de renda mínima familiar em {formatCurrency(Math.abs(diffMinIncome))}, facilitando a aprovação cadastral inicial no banco.
            </p>
          </div>
        </div>

        {/* Tabela Comparativa Detalhada */}
        <div className="overflow-x-auto border border-white/5 rounded-xl">
          <table className="w-full text-left text-xs text-white/80">
            <thead className="bg-white/5 text-[10px] uppercase font-black tracking-wider text-white/40 border-b border-white/10">
              <tr>
                <th className="py-3 px-4">Métrica Financeira</th>
                <th className="py-3 px-4 text-emerald-400">Tabela SAC</th>
                <th className="py-3 px-4 text-indigo-400">Tabela Price</th>
                <th className="py-3 px-4 text-right">Diferencial (Price vs SAC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              <tr>
                <td className="py-2.5 px-4 font-sans font-bold text-white">Primeiro Encargo Mensal (1º mês)</td>
                <td className="py-2.5 px-4 font-bold text-emerald-400">{formatCurrency(sacSum.firstInstallment)}</td>
                <td className="py-2.5 px-4 font-bold text-indigo-400">{formatCurrency(priceSum.firstInstallment)}</td>
                <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                  {formatCurrency(diffFirstInstallment)} ({((diffFirstInstallment / sacSum.firstInstallment) * 100).toFixed(1)}%)
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-white/70 pl-8">↳ Amortização Inicial</td>
                <td className="py-2.5 px-4">{formatCurrency(sacInst1?.regularAmortization || 0)}</td>
                <td className="py-2.5 px-4">{formatCurrency(priceInst1?.regularAmortization || 0)}</td>
                <td className="py-2.5 px-4 text-right text-white/50">
                  SAC amortiza {((sacInst1?.regularAmortization || 1) / (priceInst1?.regularAmortization || 1)).toFixed(1)}x mais capital
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-white/70 pl-8">↳ Juros Iniciais</td>
                <td className="py-2.5 px-4">{formatCurrency(sacInst1?.interest || 0)}</td>
                <td className="py-2.5 px-4">{formatCurrency(priceInst1?.interest || 0)}</td>
                <td className="py-2.5 px-4 text-right text-white/50">Equivalentes na abertura</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans text-white/70 pl-8">↳ Seguros & Tarifas Iniciais</td>
                <td className="py-2.5 px-4">{formatCurrency(sacInst1?.totalInsuranceAndFees || 0)}</td>
                <td className="py-2.5 px-4">{formatCurrency(priceInst1?.totalInsuranceAndFees || 0)}</td>
                <td className="py-2.5 px-4 text-right text-white/50">Idênticos</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans font-bold text-white">Encargo Intermediário (Mês {Math.floor(params.termMonths / 2)})</td>
                <td className="py-2.5 px-4">{formatCurrency(sacSum.intermediateInstallment)}</td>
                <td className="py-2.5 px-4">{formatCurrency(priceSum.intermediateInstallment)}</td>
                <td className="py-2.5 px-4 text-right text-indigo-400">
                  SAC passa a ser {formatCurrency(priceSum.intermediateInstallment - sacSum.intermediateInstallment)} menor
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans font-bold text-white">Último Encargo Mensal</td>
                <td className="py-2.5 px-4 font-bold text-emerald-400">{formatCurrency(sacSum.lastInstallment)}</td>
                <td className="py-2.5 px-4 font-bold text-indigo-400">{formatCurrency(priceSum.lastInstallment)}</td>
                <td className="py-2.5 px-4 text-right text-rose-400">
                  Price é {((priceSum.lastInstallment / sacSum.lastInstallment)).toFixed(1)}x maior no final
                </td>
              </tr>
              <tr className="bg-white/5">
                <td className="py-3 px-4 font-sans font-bold text-white">Volume Total Pago em Juros</td>
                <td className="py-3 px-4 font-black text-emerald-400">{formatCurrency(sacSum.totalInterest)}</td>
                <td className="py-3 px-4 font-black text-rose-400">{formatCurrency(priceSum.totalInterest)}</td>
                <td className="py-3 px-4 text-right font-black text-rose-400">
                  +{formatCurrency(diffTotalInterest)} (+{((diffTotalInterest / sacSum.totalInterest) * 100).toFixed(1)}%)
                </td>
              </tr>
              <tr className="bg-white/5">
                <td className="py-3 px-4 font-sans font-bold text-white">Custo Total Final Desembolsado</td>
                <td className="py-3 px-4 font-black text-white">{formatCurrency(sacSum.totalPaid)}</td>
                <td className="py-3 px-4 font-black text-white">{formatCurrency(priceSum.totalPaid)}</td>
                <td className="py-3 px-4 text-right font-black text-rose-400">
                  +{formatCurrency(diffTotalPaid)} (+{((diffTotalPaid / sacSum.totalPaid) * 100).toFixed(1)}%)
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-sans font-bold text-white">Renda Mínima Exigida (30% margem)</td>
                <td className="py-2.5 px-4">{formatCurrency(sacSum.minGrossIncomeRequired)}</td>
                <td className="py-2.5 px-4">{formatCurrency(priceSum.minGrossIncomeRequired)}</td>
                <td className="py-2.5 px-4 text-right text-emerald-400">
                  Price reduz barreira em {formatCurrency(Math.abs(diffMinIncome))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Fechar Comparativo
          </button>
        </div>
      </div>
    </div>
  );
};
