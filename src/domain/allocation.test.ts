import { describe, expect, it } from 'vitest'
import { createEmptyPortfolioData } from '../store/useInvestmentStore'
import {
  CLASS_CATALOG,
  DEFAULT_TARGETS,
  computeAllocation,
  migrateSnapshot,
  migrateTargets,
  normalizeWeights,
  retargetAfterCategoryOps,
} from './allocation'

const sum = (targets: Record<string, number>) => Object.values(targets).reduce((acc, v) => acc + v, 0)

describe('normalizeWeights', () => {
  it('rescales free weights to 100', () => {
    expect(normalizeWeights({ 'Ações': 2, 'FIIs': 1, 'ETFs': 1 })).toEqual({ 'Ações': 50, 'FIIs': 25, 'ETFs': 25 })
  })

  it('puts the rounding residual on the largest class', () => {
    const result = normalizeWeights({ a: 1, b: 1, c: 1 })
    expect(sum(result)).toBeCloseTo(100, 5)
    expect(Object.values(result).sort()).toEqual([33.3, 33.3, 33.4])
  })

  it('drops non-positive and invalid weights', () => {
    expect(normalizeWeights({ a: 10, b: 0, c: -5, d: NaN })).toEqual({ a: 100 })
    expect(normalizeWeights({ a: 0 })).toEqual({})
  })

  it('keeps already normalized targets untouched', () => {
    expect(normalizeWeights(DEFAULT_TARGETS)).toEqual(DEFAULT_TARGETS)
  })
})

describe('migrateTargets', () => {
  it('converts the legacy three-key shape', () => {
    expect(migrateTargets({ fiis: 30, acoes: 40, renda_fixa: 30 })).toEqual({ 'FIIs': 30, 'Ações': 40, 'Renda Fixa': 30 })
  })

  it('keeps the current shape and an empty strategy', () => {
    expect(migrateTargets({ 'ETFs': 60, 'Cripto': 40 })).toEqual({ 'ETFs': 60, 'Cripto': 40 })
    expect(migrateTargets({})).toEqual({})
  })

  it('falls back to the default for garbage', () => {
    expect(migrateTargets(undefined)).toEqual(DEFAULT_TARGETS)
    expect(migrateTargets('x')).toEqual(DEFAULT_TARGETS)
  })

  it('does not pollute the prototype', () => {
    const result = migrateTargets(JSON.parse('{"__proto__": 50, "Ações": 50}'))
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(sum(result)).toBeCloseTo(100, 5)
  })
})

describe('migrateSnapshot', () => {
  it('renames legacy keys without rescaling', () => {
    const snap = migrateSnapshot({ id: '1', targets: { fiis: 30, acoes: 40, rf: 30 }, current: { fiis: 10, acoes: 20, rf: 50 } })
    expect(snap.targets).toEqual({ 'FIIs': 30, 'Ações': 40, 'Renda Fixa': 30 })
    expect(snap.current).toEqual({ 'FIIs': 10, 'Ações': 20, 'Renda Fixa': 50 })
    expect(snap.id).toBe('1')
  })

  it('tolerates missing fields', () => {
    expect(migrateSnapshot({} as { targets?: unknown; current?: unknown }).current).toEqual({})
  })
})

describe('computeAllocation', () => {
  const data = {
    ...createEmptyPortfolioData(),
    acoes: [{ Ticker: 'PETR4', Quantidade: 10, Posicao: 500 }],
    tesouro: [{ Titulo: 'Tesouro Selic 2029', Quantidade: 1, Posicao: 300 }],
    manualAssets: [{ Ticker: 'BTC', Categoria: 'Cripto', Quantidade: 1, Posicao: 200 }],
  }
  const categories = ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'Cripto', 'ETFs']

  it('lists classes with a target or with assets, and current sums to 100', () => {
    const rows = computeAllocation(data, { 'Ações': 60, 'FIIs': 40 }, categories)
    expect(rows.map((r) => r.name)).toEqual(['Ações', 'FIIs', 'Tesouro Direto', 'Cripto'])
    expect(rows.reduce((acc, r) => acc + r.currentPct, 0)).toBeCloseTo(100, 5)
    const tesouro = rows.find((r) => r.name === 'Tesouro Direto')!
    expect(tesouro).toMatchObject({ inStrategy: false, hasAssets: true, targetPct: 0, builtin: true })
    const acoes = rows.find((r) => r.name === 'Ações')!
    expect(acoes.currentPct).toBeCloseTo(50, 5)
    expect(acoes.diffPct).toBeCloseTo(-10, 5)
    expect(rows.find((r) => r.name === 'FIIs')).toMatchObject({ inStrategy: true, hasAssets: false })
  })

  it('handles an empty portfolio', () => {
    expect(computeAllocation(null, { 'ETFs': 100 }, categories)).toMatchObject([{ name: 'ETFs', currentPct: 0, targetPct: 100 }])
  })
})

describe('retargetAfterCategoryOps', () => {
  const targets = { 'Ações': 50, 'Cripto': 30, 'Exterior': 20 }

  it('moves the target on rename', () => {
    expect(retargetAfterCategoryOps(targets, [{ type: 'rename_category', from: 'cripto', to: 'Criptomoedas' }], [])).toEqual({
      'Ações': 50, 'Criptomoedas': 30, 'Exterior': 20,
    })
  })

  it('merges the target into moveTo on remove', () => {
    expect(retargetAfterCategoryOps(targets, [{ type: 'remove_category', name: 'Cripto', moveTo: 'exterior' }], [])).toEqual({
      'Ações': 50, 'Exterior': 50,
    })
    expect(retargetAfterCategoryOps(targets, [{ type: 'remove_category', name: 'Cripto', moveTo: 'etfs' }], ['ETFs'])).toEqual({
      'Ações': 50, 'Exterior': 20, 'ETFs': 30,
    })
  })

  it('renormalizes when a class is removed without destination', () => {
    const result = retargetAfterCategoryOps(targets, [{ type: 'remove_category', name: 'Exterior' }], [])
    expect(result).toEqual({ 'Ações': 62.5, 'Cripto': 37.5 })
  })

  it('ignores operations on classes without target', () => {
    expect(retargetAfterCategoryOps(targets, [{ type: 'add_category', name: 'ETFs' }, { type: 'remove_category', name: 'ETFs' }], [])).toEqual(targets)
  })
})

describe('CLASS_CATALOG', () => {
  it('has unique names including market standards', () => {
    const names = CLASS_CATALOG.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toEqual(expect.arrayContaining(['ETFs', 'Exterior', 'Cripto', 'REITs']))
  })
})
