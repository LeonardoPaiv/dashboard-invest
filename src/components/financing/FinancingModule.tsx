import React, { useState, useMemo } from 'react';
import { useFinancingStore, FINANCING_PRESETS } from '../../store/useFinancingStore';
import { simulateFinancing } from '../../utils/financingEngine';
import { FinancingSummaryCards } from './FinancingSummaryCards';
import { FinancingControls } from './FinancingControls';
import { AmortizationStrategyPanel } from './AmortizationStrategyPanel';
import { FinancingCharts } from './FinancingCharts';
import { InstallmentsTable } from './InstallmentsTable';
import { SacPriceComparisonModal } from './SacPriceComparisonModal';
import {
  Building2,
  Scale,
  RotateCcw,
  Zap
} from 'lucide-react';

export const FinancingModule: React.FC = () => {
  const {
    params,
    extraConfig,
    selectedPresetId,
    updateParams,
    updateExtraConfig,
    addLumpSum,
    removeLumpSum,
    applyPreset,
    resetToDefaults
  } = useFinancingStore();

  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Executa o motor financeiro com reatividade imediata
  const simulationResult = useMemo(() => {
    return simulateFinancing(params, extraConfig);
  }, [params, extraConfig]);

  // Executa cenário base sem amortizações extraordinárias para alimentar gráficos comparativos
  const baseResult = useMemo(() => {
    if (!extraConfig.enabled) return undefined;
    return simulateFinancing(params, { ...extraConfig, enabled: false });
  }, [params, extraConfig]);

  const { summary, comparison, installments } = simulationResult;

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar">
      {/* Header Principal */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 text-primary">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Calculadora de Financiamento Imobiliário
              </h1>
              <p className="text-xs text-white/40">
                Simulador habitacional com normas do BACEN, Súmula 450 do STJ, seguros atuariais e estratégias avançadas de amortização.
              </p>
            </div>
          </div>
        </div>

        {/* Presets Rápidos e Ações */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
          {/* Presets Rápidos */}
          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 overflow-x-auto custom-scrollbar">
            {FINANCING_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  selectedPresetId === preset.id
                    ? 'bg-primary text-black font-black shadow-md shadow-primary/20'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* Botão Comparar SAC vs Price */}
          <button
            type="button"
            onClick={() => setIsCompareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/20 hover:bg-secondary/30 text-secondary border border-secondary/30 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Scale size={14} />
            <span>SAC vs Price</span>
          </button>

          {/* Botão Resetar */}
          <button
            type="button"
            onClick={resetToDefaults}
            className="p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
            title="Resetar parâmetros para o padrão"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Banner de Impacto da Estratégia de Amortização (Quando Ativa) */}
      {extraConfig.enabled && comparison && comparison.monthsSaved > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Estratégia de Quitação Acelerada Ativa!</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  Economia de {comparison.monthsSaved} meses
                </span>
              </h4>
              <p className="text-xs text-white/60">
                Seu financiamento será quitado em{' '}
                <strong className="text-white">
                  {(summary.actualMonthsToPayoff / 12).toFixed(1)} anos
                </strong>{' '}
                (em vez de {(summary.originalMonths / 12).toFixed(0)} anos), poupando{' '}
                <strong className="text-emerald-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(comparison.interestSaved)}
                </strong>{' '}
                em juros que deixam de ser pagos ao banco.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            <div className="text-right">
              <span className="text-[10px] uppercase font-black text-white/40 block">Juros Economizados</span>
              <span className="text-base font-black text-emerald-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(comparison.interestSaved)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPIs / Cards de Resumo */}
      <FinancingSummaryCards
        summary={summary}
        comparison={comparison}
        isExtraEnabled={extraConfig.enabled}
      />

      {/* Grid Principal: Painéis de Configuração à Esquerda, Visualizações à Direita */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Formulários e Estratégias (4 colunas) */}
        <div className="xl:col-span-4 space-y-6">
          <FinancingControls params={params} onChange={updateParams} />
          <AmortizationStrategyPanel
            config={extraConfig}
            onChange={updateExtraConfig}
            onAddLumpSum={addLumpSum}
            onRemoveLumpSum={removeLumpSum}
          />
        </div>

        {/* Coluna Direita: Gráficos e Tabela de Parcelas (8 colunas) */}
        <div className="xl:col-span-8 space-y-6">
          <FinancingCharts
            result={simulationResult}
            baseResult={baseResult}
            isExtraEnabled={extraConfig.enabled}
          />
          <InstallmentsTable
            installments={installments}
          />
        </div>
      </div>

      {/* Modal de Confronto SAC vs Price */}
      <SacPriceComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        params={params}
      />
    </div>
  );
};
