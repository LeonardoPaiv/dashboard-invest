import React, { useState } from 'react';
import { FinancingParameters } from '../../types/financing';
import {
  Building2,
  Calendar,
  Percent,
  ChevronDown,
  ChevronUp,
  FileText,
  User,
  ShieldAlert
} from 'lucide-react';

interface Props {
  params: FinancingParameters;
  onChange: (partial: Partial<FinancingParameters>) => void;
}

export const FinancingControls: React.FC<Props> = ({ params, onChange }) => {
  const [showExpenses, setShowExpenses] = useState(false);
  const [showInsurance, setShowInsurance] = useState(false);

  const effectiveCollateral = params.useCustomAppraisal
    ? Math.min(params.propertyValue, params.appraisalValue)
    : params.propertyValue;

  const downPaymentPercent = effectiveCollateral > 0
    ? (params.downPayment / effectiveCollateral) * 100
    : 0;

  const handleDownPaymentPercentChange = (pct: number) => {
    const newDownPayment = (effectiveCollateral * pct) / 100;
    onChange({ downPayment: Math.round(newDownPayment) });
  };

  const currentTermYears = (params.termMonths / 12).toFixed(1);
  const maxBorrowerAgeAllowed = 80.5;
  const ageAtMaturity = params.borrowerAge + params.termMonths / 12;
  const exceedsAgeLimit = ageAtMaturity > maxBorrowerAgeAllowed;

  return (
    <div className="bg-card border border-white/10 rounded-2xl p-5 space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-primary" />
          <h3 className="font-bold text-sm text-white">Parâmetros do Financiamento</h3>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/50">
          SFH / SFI
        </span>
      </div>

      {/* Modelo de Amortização (SAC vs PRICE) */}
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-wider text-white/40">
          Sistema de Amortização
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ amortizationType: 'SAC' })}
            className={`p-3 rounded-xl border text-left transition-all relative ${
              params.amortizationType === 'SAC'
                ? 'bg-primary/10 border-primary text-white shadow-lg shadow-primary/10'
                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-xs">SAC</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/10 text-primary uppercase">
                Decrescente
              </span>
            </div>
            <p className="text-[10px] text-white/40 leading-tight">
              Amortização constante. Menor volume total de juros pagos.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChange({ amortizationType: 'PRICE' })}
            className={`p-3 rounded-xl border text-left transition-all relative ${
              params.amortizationType === 'PRICE'
                ? 'bg-secondary/10 border-secondary text-white shadow-lg shadow-secondary/10'
                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-xs">Tabela Price</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/10 text-secondary uppercase">
                Constante
              </span>
            </div>
            <p className="text-[10px] text-white/40 leading-tight">
              Parcelas teóricas estáveis. Exige menor renda inicial.
            </p>
          </button>
        </div>
      </div>

      {/* Valor do Imóvel & Avaliação */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-white/40 flex justify-between">
            <span>Valor de Compra e Venda (R$)</span>
            {params.propertyValue > 1500000 && (
              <span className="text-amber-400 font-bold lowercase">
                (&gt; R$ 1.5M: enquadrado em SFI)
              </span>
            )}
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">R$</span>
            <input
              type="number"
              step="5000"
              value={params.propertyValue}
              onChange={(e) => {
                const val = Math.max(0, parseFloat(e.target.value) || 0);
                onChange({
                  propertyValue: val,
                  appraisalValue: params.useCustomAppraisal ? params.appraisalValue : val
                });
              }}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-sm font-bold text-white focus:border-primary/50 outline-none transition-all"
            />
          </div>
        </div>

        {/* Checkbox de Avaliação Customizada */}
        <div className="flex items-center justify-between text-xs text-white/60">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={params.useCustomAppraisal}
              onChange={(e) =>
                onChange({
                  useCustomAppraisal: e.target.checked,
                  appraisalValue: e.target.checked ? params.appraisalValue : params.propertyValue
                })
              }
              className="rounded border-white/20 bg-white/5 text-primary focus:ring-0 cursor-pointer"
            />
            <span>Laudo de Avaliação difere do valor de compra</span>
          </label>
        </div>

        {params.useCustomAppraisal && (
          <div className="space-y-1.5 bg-black/20 p-3 rounded-xl border border-white/5">
            <label className="text-[10px] font-black uppercase tracking-wider text-white/40 flex justify-between">
              <span>Valor do Laudo de Avaliação (R$)</span>
              <span className="text-white/30 text-[10px]">Menor base usada para LTV</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">R$</span>
              <input
                type="number"
                step="5000"
                value={params.appraisalValue}
                onChange={(e) => onChange({ appraisalValue: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-3 text-sm font-bold text-white focus:border-primary/50 outline-none transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* Valor de Entrada & LTV */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-white/40">
          <span>Valor da Entrada</span>
          <span className="text-primary font-bold">{downPaymentPercent.toFixed(1)}% do imóvel</span>
        </div>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">R$</span>
          <input
            type="number"
            step="1000"
            value={params.downPayment}
            onChange={(e) => onChange({ downPayment: Math.max(0, parseFloat(e.target.value) || 0) })}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-sm font-bold text-white focus:border-primary/50 outline-none transition-all"
          />
        </div>

        {/* Quick Percent Buttons */}
        <div className="flex gap-1.5 pt-1">
          {[10, 20, 30, 40, 50].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => handleDownPaymentPercentChange(pct)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                Math.abs(downPaymentPercent - pct) < 0.5
                  ? 'bg-primary text-black font-black'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Prazo (Meses e Anos) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-white/40">
          <span>Prazo do Financiamento</span>
          <span className="text-white/60 font-bold">{currentTermYears} anos ({params.termMonths} meses)</span>
        </div>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">
            <Calendar size={14} />
          </span>
          <input
            type="number"
            step="12"
            max="420"
            min="12"
            value={params.termMonths}
            onChange={(e) => onChange({ termMonths: Math.min(420, Math.max(1, parseInt(e.target.value) || 1)) })}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-sm font-bold text-white focus:border-primary/50 outline-none transition-all"
          />
        </div>

        {/* Quick Term Buttons */}
        <div className="flex gap-1.5 pt-1">
          {[
            { label: '10 anos', months: 120 },
            { label: '20 anos', months: 240 },
            { label: '30 anos', months: 360 },
            { label: '35 anos', months: 420 }
          ].map((item) => (
            <button
              key={item.months}
              type="button"
              onClick={() => onChange({ termMonths: item.months })}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                params.termMonths === item.months
                  ? 'bg-white/20 text-white font-black'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Taxa de Juros Nominal Anual */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-white/40">
          <span>Taxa de Juros Nominal (% a.a.)</span>
          <span className="text-white/60 font-bold">
            {((params.annualInterestRateNominal / 12)).toFixed(4)}% a.m. linear
          </span>
        </div>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30">
            <Percent size={14} />
          </span>
          <input
            type="number"
            step="0.1"
            value={params.annualInterestRateNominal}
            onChange={(e) => onChange({ annualInterestRateNominal: Math.max(0, parseFloat(e.target.value) || 0) })}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-3 text-sm font-bold text-white focus:border-primary/50 outline-none transition-all"
          />
        </div>
      </div>

      {/* Tipo de Indexador e Correção Monetária */}
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-wider text-white/40">
          Indexador Contratual
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {(['TR', 'IPCA', 'POUPANCA', 'PREFIXADO'] as const).map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                let defaultRate = 0.08;
                if (idx === 'PREFIXADO') defaultRate = 0;
                if (idx === 'IPCA') defaultRate = 0.35;
                if (idx === 'POUPANCA') defaultRate = 0.08;
                onChange({ indexerType: idx, monthlyIndexerRate: defaultRate });
              }}
              className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
                params.indexerType === idx
                  ? 'bg-primary text-black font-black'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {idx === 'POUPANCA' ? 'Poupança' : idx === 'PREFIXADO' ? 'Prefixado' : idx}
            </button>
          ))}
        </div>

        {params.indexerType !== 'PREFIXADO' && (
          <div className="flex items-center justify-between bg-black/20 p-2.5 rounded-xl border border-white/5 text-xs mt-2">
            <span className="text-[10px] text-white/40 font-bold uppercase">Projeção {params.indexerType} Mensal:</span>
            <div className="flex items-center gap-1 w-24">
              <input
                type="number"
                step="0.01"
                value={params.monthlyIndexerRate}
                onChange={(e) => onChange({ monthlyIndexerRate: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white/10 border border-white/10 rounded-lg py-1 px-2 text-right text-xs font-bold text-white outline-none"
              />
              <span className="text-white/40 text-[10px] font-bold">%</span>
            </div>
          </div>
        )}
      </div>

      {/* Custos Iniciais de Formalização (Accordion) */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowExpenses(!showExpenses)}
          className="w-full p-3 bg-white/5 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-sky-400" />
            <span className="text-xs font-bold text-white">Custos Iniciais de Cartório & ITBI</span>
          </div>
          {showExpenses ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
        </button>

        {showExpenses && (
          <div className="p-4 bg-black/30 space-y-3.5 text-xs border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-white/60">ITBI Municipal (%)</label>
              <input
                type="number"
                step="0.5"
                value={params.itbiPercent}
                onChange={(e) => onChange({ itbiPercent: parseFloat(e.target.value) || 0 })}
                className="w-20 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-right text-xs font-bold text-white outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/60">Emolumentos Cartório (%)</label>
              <input
                type="number"
                step="0.1"
                value={params.registryFeePercent}
                onChange={(e) => onChange({ registryFeePercent: parseFloat(e.target.value) || 0 })}
                className="w-20 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-right text-xs font-bold text-white outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/60">Tarifa de Avaliação de Engenharia</label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-white/30 font-bold">R$</span>
                <input
                  type="number"
                  step="100"
                  value={params.appraisalFeeFixed}
                  onChange={(e) => onChange({ appraisalFeeFixed: parseFloat(e.target.value) || 0 })}
                  className="w-24 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-right text-xs font-bold text-white outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer text-[11px] text-white/70">
              <input
                type="checkbox"
                checked={params.applySFHDiscount}
                onChange={(e) => onChange({ applySFHDiscount: e.target.checked })}
                className="rounded border-white/20 bg-white/5 text-primary focus:ring-0 cursor-pointer"
              />
              <span>Desconto de 50% em cartório (1º Imóvel - Art. 290 Lei 6.015/73)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-white/70">
              <input
                type="checkbox"
                checked={params.financeInitialExpenses}
                onChange={(e) => onChange({ financeInitialExpenses: e.target.checked })}
                className="rounded border-white/20 bg-white/5 text-primary focus:ring-0 cursor-pointer"
              />
              <span>Incorporar custas iniciais ao saldo financiado</span>
            </label>
          </div>
        )}
      </div>

      {/* Seguros e Dados do Mutuário (Accordion) */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowInsurance(!showInsurance)}
          className="w-full p-3 bg-white/5 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <User size={15} className="text-emerald-400" />
            <span className="text-xs font-bold text-white">Mutuário, Renda & Seguros MIP/DFI</span>
          </div>
          {showInsurance ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
        </button>

        {showInsurance && (
          <div className="p-4 bg-black/30 space-y-3.5 text-xs border-t border-white/10">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-white/60">Idade do Titular Mais Velho</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={params.borrowerAge}
                    onChange={(e) => onChange({ borrowerAge: parseInt(e.target.value) || 18 })}
                    className="w-16 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-right text-xs font-bold text-white outline-none"
                  />
                  <span className="text-[10px] text-white/40">anos</span>
                </div>
              </div>
              {exceedsAgeLimit && (
                <div className="text-[10px] text-rose-400 flex items-center gap-1 mt-1 bg-rose-500/10 p-1.5 rounded-lg">
                  <ShieldAlert size={12} />
                  <span>Atenção: idade ao final ({ageAtMaturity.toFixed(1)} anos) excede o teto SUSEP de 80,5 anos!</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/60">Renda Bruta Familiar Comprovada (R$)</label>
              <input
                type="number"
                step="500"
                value={params.monthlyGrossIncome}
                onChange={(e) => onChange({ monthlyGrossIncome: parseFloat(e.target.value) || 0 })}
                className="w-28 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-right text-xs font-bold text-white outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/60">Seguro DFI (% a.m.)</label>
              <input
                type="number"
                step="0.001"
                value={params.dfiMonthlyRate}
                onChange={(e) => onChange({ dfiMonthlyRate: parseFloat(e.target.value) || 0 })}
                className="w-20 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-right text-xs font-bold text-white outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-white/60">Tarifa TCA Mensal (R$)</label>
              <input
                type="number"
                step="1"
                value={params.tcaMonthlyFixed}
                onChange={(e) => onChange({ tcaMonthlyFixed: parseFloat(e.target.value) || 0 })}
                className="w-20 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-right text-xs font-bold text-white outline-none"
              />
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer text-[11px] text-white/70">
              <input
                type="checkbox"
                checked={params.useCustomMipRate}
                onChange={(e) => onChange({ useCustomMipRate: e.target.checked })}
                className="rounded border-white/20 bg-white/5 text-primary focus:ring-0 cursor-pointer"
              />
              <span>Fixar alíquota do MIP (em vez da matriz de idade)</span>
            </label>

            {params.useCustomMipRate && (
              <div className="flex items-center justify-between pt-1">
                <label className="text-white/60">Alíquota MIP Fixa (% a.m.)</label>
                <input
                  type="number"
                  step="0.001"
                  value={params.customMipRate}
                  onChange={(e) => onChange({ customMipRate: parseFloat(e.target.value) || 0 })}
                  className="w-20 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-right text-xs font-bold text-white outline-none"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
