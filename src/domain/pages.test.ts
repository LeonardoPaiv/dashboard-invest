import { describe, expect, it } from 'vitest'
import { PAGES, isPageId, pageLabel } from './pages'

describe('pages', () => {
  it('lists every tab the app renders', () => {
    expect(PAGES.map((p) => p.id)).toEqual([
      'dashboard', 'strategy', 'projection', 'plano-mensal', 'preco-medio',
      'imposto-renda', 'financiamento', 'history', 'data-management',
    ])
  })
  it('recognises page ids and falls back to the raw id for labels', () => {
    expect(isPageId('financiamento')).toBe(true)
    expect(isPageId('nope')).toBe(false)
    expect(isPageId(undefined)).toBe(false)
    expect(pageLabel('plano-mensal')).toBe('Plano Mensal')
    expect(pageLabel('nope')).toBe('nope')
  })
})
