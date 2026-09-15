import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  FinancingParameters,
  ExtraAmortizationConfig,
  LumpSumAmortization
} from '../types/financing';

export interface FinancingPreset {
  id: string;
  name: string;
  description: string;
  params: Partial<FinancingParameters>;
  extraConfig?: Partial<ExtraAmortizationConfig>;
}

export const FINANCING_PRESETS: FinancingPreset[] = [
  {
    id: 'sfh_caixa_sac',
    name: 'SFH Padrão Caixa (SAC)',
    description: 'Entrada de 20%, 360 meses, 10% a.a., SAC com TR',
    params: {
      propertyValue: 500000,
      appraisalValue: 500000,
      useCustomAppraisal: false,
      downPayment: 100000,
      termMonths: 360,
      annualInterestRateNominal: 10.0,
      amortizationType: 'SAC',
      indexerType: 'TR',
      monthlyIndexerRate: 0.08,
      financeInitialExpenses: false,
      itbiPercent: 3.0,
      registryFeePercent: 1.0,
      appraisalFeeFixed: 3500,
      applySFHDiscount: true,
      borrowerAge: 32,
      dfiMonthlyRate: 0.0100,
      tcaMonthlyFixed: 25.0,
      useCustomMipRate: false,
      monthlyGrossIncome: 16000
    }
  },
  {
    id: 'price_banco_privado',
    name: 'Tabela Price (Banco Privado)',
    description: 'Entrada de 30%, 360 meses, 10.8% a.a., Price sem TR',
    params: {
      propertyValue: 600000,
      appraisalValue: 600000,
      useCustomAppraisal: false,
      downPayment: 180000,
      termMonths: 360,
      annualInterestRateNominal: 10.8,
      amortizationType: 'PRICE',
      indexerType: 'TR',
      monthlyIndexerRate: 0.05,
      financeInitialExpenses: false,
      itbiPercent: 3.0,
      registryFeePercent: 1.0,
      appraisalFeeFixed: 3800,
      applySFHDiscount: true,
      borrowerAge: 35,
      dfiMonthlyRate: 0.0100,
      tcaMonthlyFixed: 25.0,
      useCustomMipRate: false,
      monthlyGrossIncome: 14000
    }
  },
  {
    id: 'mcmv_social',
    name: 'Minha Casa Minha Vida (MCMV)',
    description: 'Imóvel até R$ 350k, juros de 7.66% a.a., SAC',
    params: {
      propertyValue: 300000,
      appraisalValue: 300000,
      useCustomAppraisal: false,
      downPayment: 60000,
      termMonths: 420,
      annualInterestRateNominal: 7.66,
      amortizationType: 'SAC',
      indexerType: 'TR',
      monthlyIndexerRate: 0.05,
      financeInitialExpenses: true,
      itbiPercent: 2.0,
      registryFeePercent: 0.8,
      appraisalFeeFixed: 2500,
      applySFHDiscount: true,
      borrowerAge: 28,
      dfiMonthlyRate: 0.0080,
      tcaMonthlyFixed: 25.0,
      useCustomMipRate: false,
      monthlyGrossIncome: 7500
    }
  },
  {
    id: 'credito_poupanca',
    name: 'Atrelado à Poupança',
    description: 'Taxa fixa 3.99% + Poupança (limitada a 6.17% quando Selic > 8.5%)',
    params: {
      propertyValue: 750000,
      appraisalValue: 750000,
      useCustomAppraisal: false,
      downPayment: 200000,
      termMonths: 360,
      annualInterestRateNominal: 10.16, // 3.99 + 6.17
      amortizationType: 'SAC',
      indexerType: 'POUPANCA',
      monthlyIndexerRate: 0.08,
      financeInitialExpenses: false,
      itbiPercent: 3.0,
      registryFeePercent: 1.0,
      appraisalFeeFixed: 3600,
      applySFHDiscount: true,
      borrowerAge: 38,
      dfiMonthlyRate: 0.0100,
      tcaMonthlyFixed: 25.0,
      useCustomMipRate: false,
      monthlyGrossIncome: 22000
    }
  }
];

const DEFAULT_PARAMS: FinancingParameters = {
  propertyValue: 500000,
  appraisalValue: 500000,
  useCustomAppraisal: false,
  downPayment: 100000,
  termMonths: 360,
  annualInterestRateNominal: 10.0,
  amortizationType: 'SAC',
  indexerType: 'TR',
  monthlyIndexerRate: 0.08,
  financeInitialExpenses: false,
  itbiPercent: 3.0,
  registryFeePercent: 1.0,
  appraisalFeeFixed: 3500,
  applySFHDiscount: true,
  borrowerAge: 32,
  dfiMonthlyRate: 0.0100,
  tcaMonthlyFixed: 25.0,
  useCustomMipRate: false,
  customMipRate: 0.0280,
  monthlyGrossIncome: 16000
};

const DEFAULT_EXTRA_CONFIG: ExtraAmortizationConfig = {
  enabled: false,
  mode: 'constant',
  recalculation: 'prazo',
  monthlyAmount: 1500,
  targetInstallment: 2000,
  periodStartMonth: 1,
  periodEndMonth: 60,
  lumpSums: []
};

interface FinancingStoreState {
  params: FinancingParameters;
  extraConfig: ExtraAmortizationConfig;
  selectedPresetId: string | null;

  // Actions
  updateParams: (partial: Partial<FinancingParameters>) => void;
  updateExtraConfig: (partial: Partial<ExtraAmortizationConfig>) => void;
  addLumpSum: (lumpSum: Omit<LumpSumAmortization, 'id'>) => void;
  removeLumpSum: (id: string) => void;
  updateLumpSum: (id: string, updates: Partial<LumpSumAmortization>) => void;
  applyPreset: (presetId: string) => void;
  resetToDefaults: () => void;
}

export const useFinancingStore = create<FinancingStoreState>()(
  persist(
    (set) => ({
      params: DEFAULT_PARAMS,
      extraConfig: DEFAULT_EXTRA_CONFIG,
      selectedPresetId: 'sfh_caixa_sac',

      updateParams: (partial) =>
        set((state) => ({
          params: { ...state.params, ...partial },
          selectedPresetId: null
        })),

      updateExtraConfig: (partial) =>
        set((state) => ({
          extraConfig: { ...state.extraConfig, ...partial }
        })),

      addLumpSum: (lumpSum) =>
        set((state) => ({
          extraConfig: {
            ...state.extraConfig,
            lumpSums: [
              ...state.extraConfig.lumpSums,
              { ...lumpSum, id: crypto.randomUUID() }
            ]
          }
        })),

      removeLumpSum: (id) =>
        set((state) => ({
          extraConfig: {
            ...state.extraConfig,
            lumpSums: state.extraConfig.lumpSums.filter((l) => l.id !== id)
          }
        })),

      updateLumpSum: (id, updates) =>
        set((state) => ({
          extraConfig: {
            ...state.extraConfig,
            lumpSums: state.extraConfig.lumpSums.map((l) =>
              l.id === id ? { ...l, ...updates } : l
            )
          }
        })),

      applyPreset: (presetId) => {
        const preset = FINANCING_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        set((state) => ({
          params: { ...state.params, ...preset.params },
          extraConfig: preset.extraConfig
            ? { ...state.extraConfig, ...preset.extraConfig }
            : state.extraConfig,
          selectedPresetId: presetId
        }));
      },

      resetToDefaults: () =>
        set({
          params: DEFAULT_PARAMS,
          extraConfig: DEFAULT_EXTRA_CONFIG,
          selectedPresetId: 'sfh_caixa_sac'
        })
    }),
    {
      name: 'investdash-financing-storage'
    }
  )
);
