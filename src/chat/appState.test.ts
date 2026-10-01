import { beforeEach, describe, expect, it } from 'vitest'
import { useFinancingStore } from '../store/useFinancingStore'
import { useInvestmentStore } from '../store/useInvestmentStore'
import { useProjectionStore } from '../store/useProjectionStore'
import { readSettingsSnapshot, writeSettingsSnapshot } from './appState'

beforeEach(() => {
  useInvestmentStore.getState().clearAllData()
  useFinancingStore.getState().resetToDefaults()
  useProjectionStore.setState(useProjectionStore.getInitialState(), true)
})

describe('appState', () => {
  it('reads every configurable area of the app', () => {
    const snap = readSettingsSnapshot()
    expect(snap.portfolios).toHaveLength(1)
    expect(snap).toMatchObject({
      activePortfolioId: 'default',
      contributionAmount: 1000,
      projection: { monthlyContribution: 1000, annualRate: 10, years: 10 },
    })
    expect(snap.financing.params.termMonths).toBe(360)
    expect(snap.monthlyPlan.categories).toContain('Outros')
  })
  it('writes a snapshot back to the three stores and refreshes the derived view', () => {
    const snap = readSettingsSnapshot()
    const extra = { ...snap.portfolios[0], id: 'p2', name: 'Viagem' }
    writeSettingsSnapshot({
      ...snap,
      portfolios: [...snap.portfolios, extra],
      activePortfolioId: 'p2',
      contributionAmount: 2500,
      settings: { ...snap.settings, alvos: { 'ETFs': 100 } },
      assetCategories: [...snap.assetCategories, 'ETFs'],
      financing: { ...snap.financing, params: { ...snap.financing.params, termMonths: 300 }, selectedPresetId: null },
      projection: { monthlyContribution: 500, annualRate: 8, years: 30 },
    })
    const invest = useInvestmentStore.getState()
    expect(invest.portfolios.map((p) => p.name)).toEqual(['Carteira Principal', 'Viagem'])
    expect(invest.activePortfolioId).toBe('p2')
    expect(invest.portfolio).toBe(invest.portfolios[1].data)
    expect(invest.contributionAmount).toBe(2500)
    expect(invest.settings.alvos).toEqual({ 'ETFs': 100 })
    expect(invest.assetCategories).toContain('ETFs')
    expect(useFinancingStore.getState()).toMatchObject({ selectedPresetId: null, params: { termMonths: 300 } })
    expect(useProjectionStore.getState()).toMatchObject({ monthlyContribution: 500, annualRate: 8, years: 30 })
  })
})
