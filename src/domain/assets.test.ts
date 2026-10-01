import { describe, expect, it } from 'vitest'
import { createEmptyPortfolioData, type Portfolio, type PortfolioData } from '../store/useInvestmentStore'
import { collectCategories, isBuiltinCategory, listAssets, sectionForCategory } from './assets'

const sample = (): PortfolioData => ({
  ...createEmptyPortfolioData(),
  acoes: [{ Ticker: 'itub4', Quantidade: 300, PrecoMedio: 28.4, Cotacao: 36.12, Posicao: 10836, Segmento: 'Bancos' }],
  fiis: [{ Ticker: 'HGLG11', Quantidade: 60, PrecoMedio: 158, Cotacao: 162.4, Posicao: 9744, Segmento: 'Logística' }],
  tesouro: [{ Titulo: 'Tesouro IPCA+ 2035', Quantidade: 4, PrecoMedio: 3000, Posicao: 13600, Vencimento: '-' }],
  renda_fixa: [{ Ativo: 'CDB Inter 110% CDI', Quantidade: 1, PrecoMedio: 10500, Posicao: 12000, Indexador: 'CDI' }],
  manualAssets: [
    { id: 'm1', Ticker: 'BTC', Categoria: 'Cripto', Quantidade: 0.5, PrecoMedio: 200000, Cotacao: 300000, Posicao: 150000, Segmento: 'Cripto' },
  ],
})

const portfolio = (data: PortfolioData): Portfolio => ({
  id: 'p1',
  name: 'Carteira Principal',
  data,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('listAssets', () => {
  it('carries the portfolio tags of consolidated records and leaves them absent otherwise', () => {
    const tagged: PortfolioData = {
      ...createEmptyPortfolioData(),
      acoes: [{ Ticker: 'ITUB4', Quantidade: 1, Cotacao: 10, Posicao: 10, portfolioId: 'p1', portfolioName: 'Principal', portfolioColor: '#fff' }],
    }
    expect(listAssets(tagged)[0]).toMatchObject({ portfolioId: 'p1', portfolioName: 'Principal' })
    const plain = listAssets(sample())[0]
    expect(plain.portfolioId).toBeUndefined()
    expect(plain.portfolioName).toBeUndefined()
  })

  it('returns an empty list for null data', () => {
    expect(listAssets(null)).toEqual([])
  })

  it('flattens every section into assets with a category', () => {
    const assets = listAssets(sample())
    expect(assets.map((a) => [a.ticker, a.category])).toEqual([
      ['ITUB4', 'Ações'],
      ['HGLG11', 'FIIs'],
      ['Tesouro IPCA+ 2035', 'Tesouro Direto'],
      ['CDB Inter 110% CDI', 'Renda Fixa'],
      ['BTC', 'Cripto'],
    ])
  })

  it('uppercases stock tickers and keeps a normalized key for every asset', () => {
    const [itub, , tesouro] = listAssets(sample())
    expect(itub.key).toBe('ITUB4')
    expect(tesouro.key).toBe('TESOURO IPCA+ 2035')
  })

  it('derives unit price from position when there is no quote', () => {
    const tesouro = listAssets(sample())[2]
    expect(tesouro.price).toBe(3400)
    expect(tesouro.value).toBe(13600)
  })

  it('falls back to the category when the segment is missing or "-"', () => {
    const assets = listAssets(sample())
    expect(assets[2].segment).toBe('Tesouro Direto')
    expect(assets[3].segment).toBe('CDI')
  })

  it('labels manual assets without Categoria as "Outros"', () => {
    const data = { ...createEmptyPortfolioData(), manualAssets: [{ id: 'x', Ticker: 'XPTO', Quantidade: 1, PrecoMedio: 10, Posicao: 10 }] }
    expect(listAssets(data)[0].category).toBe('Outros')
  })
})

describe('categories', () => {
  it('maps built-in categories to their sections and everything else to manualAssets', () => {
    expect(sectionForCategory('Ações')).toBe('acoes')
    expect(sectionForCategory('FIIs')).toBe('fiis')
    expect(sectionForCategory('Renda Fixa')).toBe('renda_fixa')
    expect(sectionForCategory('Tesouro Direto')).toBe('tesouro')
    expect(sectionForCategory('Cripto')).toBe('manualAssets')
    expect(isBuiltinCategory('Cripto')).toBe(false)
  })

  it('merges built-ins, stored categories and categories found in assets, without duplicates', () => {
    const data = { ...sample(), manualAssets: [{ id: 'm2', Ticker: 'VOO', Categoria: 'ETFs', Quantidade: 1, PrecoMedio: 1, Posicao: 1 }] }
    expect(collectCategories(['Ações', 'FIIs', 'Renda Fixa', 'Cripto', 'Exterior'], [portfolio(data)])).toEqual([
      'Ações',
      'FIIs',
      'Renda Fixa',
      'Tesouro Direto',
      'Cripto',
      'Exterior',
      'ETFs',
    ])
  })

  it('treats prototype pollution names as custom categories, not built-in', () => {
    expect(isBuiltinCategory('constructor')).toBe(false)
    expect(isBuiltinCategory('__proto__')).toBe(false)
    expect(isBuiltinCategory('toString')).toBe(false)
    expect(isBuiltinCategory('valueOf')).toBe(false)
  })

  it('maps prototype pollution names to manualAssets section', () => {
    expect(sectionForCategory('constructor')).toBe('manualAssets')
    expect(sectionForCategory('__proto__')).toBe('manualAssets')
    expect(sectionForCategory('toString')).toBe('manualAssets')
    expect(sectionForCategory('valueOf')).toBe('manualAssets')
  })
})
