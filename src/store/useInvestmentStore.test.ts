import { beforeEach, describe, expect, it } from 'vitest'
import { resolveWritablePortfolioId, useInvestmentStore } from './useInvestmentStore'

const store = () => useInvestmentStore.getState()

beforeEach(() => {
  store().clearAllData()
})

describe('applyAssetOperations', () => {
  it('applies operations to the target portfolio and refreshes the derived view', () => {
    store().applyAssetOperations('default', [
      { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 100, avgPrice: 30, mode: 'add' },
    ])
    expect(store().portfolios[0].data.acoes).toHaveLength(1)
    expect(store().portfolio?.total_live).toBe(3000)
  })

  it('stores new categories', () => {
    store().applyAssetOperations('default', [{ type: 'add_category', name: 'ETFs' }])
    expect(store().assetCategories).toContain('ETFs')
  })

  it('throws and leaves the state untouched when any operation is invalid', () => {
    const before = store().portfolios
    expect(() =>
      store().applyAssetOperations('default', [
        { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 100, avgPrice: 30, mode: 'add' },
        { type: 'remove_asset', ticker: 'NADA3' },
      ]),
    ).toThrow(/NADA3/)
    expect(store().portfolios).toBe(before)
  })

  it('throws when the target portfolio no longer exists', () => {
    expect(() =>
      store().applyAssetOperations('gone', [
        { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 1, mode: 'add' },
      ]),
    ).toThrow(/Carteira de destino não encontrada/)
  })

  it('updates updatedAt only on portfolios whose data changed', () => {
    const otherId = store().addPortfolio('Outra')
    useInvestmentStore.setState((s) => ({
      portfolios: s.portfolios.map((p) => ({ ...p, updatedAt: '2000-01-01T00:00:00.000Z' })),
    }))
    store().applyAssetOperations('default', [
      { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 1, mode: 'add' },
    ])
    const byId = Object.fromEntries(store().portfolios.map((p) => [p.id, p.updatedAt]))
    expect(byId.default).not.toBe('2000-01-01T00:00:00.000Z')
    expect(byId[otherId]).toBe('2000-01-01T00:00:00.000Z')
  })
})

describe('resolveWritablePortfolioId', () => {
  it('keeps the active portfolio when it exists', () => {
    expect(resolveWritablePortfolioId(store().portfolios, 'default')).toBe('default')
  })

  it('falls back to the first portfolio for the consolidated view or an unknown id', () => {
    expect(resolveWritablePortfolioId(store().portfolios, 'all')).toBe('default')
    expect(resolveWritablePortfolioId(store().portfolios, 'missing')).toBe('default')
  })
})

describe('allocation targets', () => {
  it('starts with class-named targets', () => {
    expect(store().settings.alvos).toEqual({ 'FIIs': 33.3, 'Ações': 33.3, 'Renda Fixa': 33.4 })
  })

  it('migrates legacy targets and snapshots when restoring an old backup', () => {
    store().loadBackup({
      version: '1.2',
      settings: { estrategia: 'Dividendos', alvos: { fiis: 30, acoes: 40, renda_fixa: 30 } },
      snapshots: [{ id: 's1', date: '01/01/2026', portfolio_total: 0, aporte: 100, result: '', targets: { fiis: 30, acoes: 40, rf: 30 }, current: { fiis: 10, acoes: 20, rf: 70 } }],
    })
    expect(store().settings).toEqual({ estrategia: 'Dividendos', alvos: { 'FIIs': 30, 'Ações': 40, 'Renda Fixa': 30 } })
    expect(store().snapshots[0].current).toEqual({ 'FIIs': 10, 'Ações': 20, 'Renda Fixa': 70 })
  })

  it('migrates legacy targets persisted in localStorage', async () => {
    localStorage.setItem('investment-storage', JSON.stringify({
      state: { settings: { estrategia: '', alvos: { fiis: 50, acoes: 25, renda_fixa: 25 } }, snapshots: [{ id: 's1', targets: { fiis: 50, acoes: 25, rf: 25 }, current: { fiis: 0, acoes: 0, rf: 0 } }] },
      version: 0,
    }))
    await useInvestmentStore.persist.rehydrate()
    expect(store().settings.alvos).toEqual({ 'FIIs': 50, 'Ações': 25, 'Renda Fixa': 25 })
    expect(Object.keys(store().snapshots[0].targets)).toEqual(['FIIs', 'Ações', 'Renda Fixa'])
  })

  it('keeps the target attached to a renamed category and drops it with a removed one', () => {
    store().applyAssetOperations('default', [{ type: 'add_category', name: 'ETFs' }])
    store().setSettings({ estrategia: '', alvos: { 'Ações': 50, 'ETFs': 30, 'Cripto': 20 } })
    store().applyAssetOperations('default', [{ type: 'rename_category', from: 'ETFs', to: 'Fundos de Índice' }])
    expect(store().settings.alvos).toEqual({ 'Ações': 50, 'Fundos de Índice': 30, 'Cripto': 20 })
    store().applyAssetOperations('default', [{ type: 'remove_category', name: 'Cripto' }])
    expect(store().settings.alvos).toEqual({ 'Ações': 62.5, 'Fundos de Índice': 37.5 })
  })
})
