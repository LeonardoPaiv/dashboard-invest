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
