import type { SettingsSnapshot } from '../domain/settingsOperations'
import { useFinancingStore } from '../store/useFinancingStore'
import { useInvestmentStore } from '../store/useInvestmentStore'
import { useProjectionStore } from '../store/useProjectionStore'

export function readSettingsSnapshot(): SettingsSnapshot {
  const invest = useInvestmentStore.getState()
  const financing = useFinancingStore.getState()
  const projection = useProjectionStore.getState()
  return {
    portfolios: invest.portfolios,
    activePortfolioId: invest.activePortfolioId,
    settings: invest.settings,
    contributionAmount: invest.contributionAmount,
    monthlyPlan: invest.monthlyPlan,
    financing: { params: financing.params, extraConfig: financing.extraConfig, selectedPresetId: financing.selectedPresetId },
    projection: {
      monthlyContribution: projection.monthlyContribution,
      annualRate: projection.annualRate,
      years: projection.years,
    },
  }
}

export function writeSettingsSnapshot(next: SettingsSnapshot): void {
  useInvestmentStore.setState({
    portfolios: next.portfolios,
    settings: next.settings,
    contributionAmount: next.contributionAmount,
    monthlyPlan: next.monthlyPlan,
  })
  // recalcula a visão derivada `portfolio`
  useInvestmentStore.getState().setActivePortfolio(next.activePortfolioId)
  useFinancingStore.setState({ ...next.financing })
  useProjectionStore.setState({ ...next.projection })
}
