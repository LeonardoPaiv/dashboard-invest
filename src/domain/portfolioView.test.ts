import { describe, expect, it } from 'vitest'
import type { Asset } from './assets'
import { CHART_COLORS, buildPortfolioView, categoryColor, donutBackground } from './portfolioView'

const asset = (ticker: string, category: string, value: number, extra: Partial<Asset> = {}): Asset => ({
  key: ticker,
  ticker,
  category,
  section: 'acoes',
  segment: 'Seg',
  quantity: 10,
  avgPrice: 8,
  price: value / 10,
  value,
  ...extra,
})

const categories = ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'Cripto']
const assets = [asset('ITUB4', 'Ações', 600), asset('WEGE3', 'Ações', 200), asset('HGLG11', 'FIIs', 200)]

describe('buildPortfolioView', () => {
  it('builds pills for "Todos" plus each category that has assets', () => {
    const view = buildPortfolioView(assets, categories, 'Todos')
    expect(view.total).toBe(1000)
    expect(view.pills).toEqual([
      { label: 'Todos', value: 1000, share: null },
      { label: 'Ações', value: 800, share: 80 },
      { label: 'FIIs', value: 200, share: 20 },
    ])
  })

  it('slices by category when showing everything', () => {
    const view = buildPortfolioView(assets, categories, 'Todos')
    expect(view.slices).toEqual([
      { name: 'Ações', value: 800, color: CHART_COLORS[0], selectable: true },
      { name: 'FIIs', value: 200, color: CHART_COLORS[1], selectable: true },
    ])
  })

  it('slices by asset and computes allocation inside the selected category', () => {
    const view = buildPortfolioView(assets, categories, 'Ações')
    expect(view.base).toBe(800)
    expect(view.slices.map((s) => [s.name, s.selectable])).toEqual([
      ['ITUB4', false],
      ['WEGE3', false],
    ])
    expect(view.rows.map((r) => [r.ticker, r.allocation, r.subtitle])).toEqual([
      ['ITUB4', 75, 'Seg'],
      ['WEGE3', 25, 'Seg'],
    ])
  })

  it('sorts rows by value and prefixes the subtitle with the category in "Todos"', () => {
    const view = buildPortfolioView(assets, categories, 'Todos')
    expect(view.rows.map((r) => r.ticker)).toEqual(['ITUB4', 'WEGE3', 'HGLG11'])
    expect(view.rows[0].subtitle).toBe('Ações · Seg')
    expect(view.rows[0].returnPct).toBeCloseTo(((60 - 8) / 8) * 100, 6)
  })

  it('groups assets beyond the eighth into "Outros"', () => {
    const many = Array.from({ length: 10 }, (_, i) => asset(`AAA${i}`, 'Ações', 100 - i))
    const view = buildPortfolioView(many, categories, 'Ações')
    expect(view.slices).toHaveLength(9)
    expect(view.slices[8]).toEqual({ name: 'Outros', value: 92 + 91, color: '#52525b', selectable: false })
  })

  it('falls back to "Todos" when the requested category has no assets', () => {
    expect(buildPortfolioView(assets, categories, 'Cripto').filter).toBe('Todos')
  })

  it('returns zero return when there is no average price and handles an empty portfolio', () => {
    const view = buildPortfolioView([asset('X', 'Ações', 100, { avgPrice: 0 })], categories, 'Todos')
    expect(view.rows[0].returnPct).toBe(0)
    const empty = buildPortfolioView([], categories, 'Todos')
    expect(empty.pills).toEqual([{ label: 'Todos', value: 0, share: null }])
    expect(empty.slices).toEqual([])
    expect(empty.rows).toEqual([])
  })

  it('gives categories outside the known list a color after the known ones', () => {
    expect(categoryColor('Cripto', categories)).toBe(CHART_COLORS[4])
    expect(categoryColor('Nova', categories)).toBe(CHART_COLORS[5])
  })
})

describe('donutBackground', () => {
  it('returns a neutral fill when there is nothing to draw', () => {
    expect(donutBackground([])).toBe('rgba(255,255,255,.05)')
  })

  it('draws one segment per slice with a small gap', () => {
    const css = donutBackground([
      { name: 'A', value: 50, color: '#4F46E5', selectable: true },
      { name: 'B', value: 50, color: '#10B981', selectable: true },
    ])
    expect(css.startsWith('conic-gradient(')).toBe(true)
    expect(css).toContain('#4F46E5 1.2deg 178.8deg')
    expect(css).toContain('#10B981 181.2deg 358.8deg')
  })

  it('draws a full ring without gaps for a single slice', () => {
    expect(donutBackground([{ name: 'A', value: 10, color: '#4F46E5', selectable: true }])).toContain('#4F46E5 0deg 360deg')
  })
})
