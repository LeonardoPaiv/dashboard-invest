import { describe, expect, it } from 'vitest'
import { brl, num, pct } from './format'

describe('format', () => {
  it('formats currency in pt-BR', () => {
    expect(brl(1234.56)).toMatch(/^R\$\s1\.234,56$/)
    expect(brl(NaN)).toMatch(/^R\$\s0,00$/)
  })

  it('formats percentages with one decimal and comma', () => {
    expect(pct(12.345)).toBe('12,3%')
    expect(pct(0)).toBe('0,0%')
  })

  it('formats plain numbers with at most two decimals', () => {
    expect(num(1200)).toBe('1.200')
    expect(num(4.256)).toBe('4,26')
  })
})
