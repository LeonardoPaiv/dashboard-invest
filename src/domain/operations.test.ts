import { describe, expect, it } from 'vitest'
import { createEmptyPortfolioData, type Portfolio, type PortfolioData } from '../store/useInvestmentStore'
import { describeOperations, runOperations, type Workspace } from './operations'

const portfolio = (id: string, data: Partial<PortfolioData> = {}): Portfolio => ({
  id,
  name: id === 'p1' ? 'Carteira Principal' : 'Outra',
  data: { ...createEmptyPortfolioData(), ...data },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const workspace = (data: Partial<PortfolioData> = {}, other: Partial<PortfolioData> = {}): Workspace => ({
  portfolios: [portfolio('p1', data), portfolio('p2', other)],
  categories: ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'Cripto'],
})

const hglg = { Ticker: 'HGLG11', Quantidade: 60, PrecoMedio: 158, Cotacao: 162.4, Posicao: 9744, Segmento: 'Logística' }
const btc = { id: 'm1', Ticker: 'BTC', Categoria: 'Cripto', Quantidade: 1, PrecoMedio: 100, Cotacao: 150, Posicao: 150, Segmento: 'Cripto' }

describe('runOperations — assets', () => {
  it('adds a new asset to the section of its category', () => {
    const { workspace: ws, errors } = runOperations(workspace(), 'p1', [
      { type: 'upsert_asset', ticker: 'bbse3', category: 'Ações', quantity: 200, avgPrice: 33.1, mode: 'add' },
    ])
    expect(errors).toEqual([])
    expect(ws.portfolios[0].data.acoes).toEqual([
      { Ticker: 'BBSE3', Quantidade: 200, PrecoMedio: 33.1, Cotacao: 33.1, Posicao: 6620, Segmento: 'Ações' },
    ])
    expect(ws.portfolios[0].data.total_live).toBe(6620)
    expect(ws.portfolios[0].data.resumo.total_investido).toBe(6620)
    expect(ws.portfolios[1].data.acoes).toEqual([])
  })

  it('sums quantity and recomputes the weighted average price in "add" mode, keeping the quote', () => {
    const { workspace: ws } = runOperations(workspace({ fiis: [hglg] }), 'p1', [
      { type: 'upsert_asset', ticker: 'hglg11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'add' },
    ])
    const record = ws.portfolios[0].data.fiis[0]
    expect(record.Quantidade).toBe(80)
    expect(record.PrecoMedio).toBeCloseTo((60 * 158 + 20 * 160.1) / 80, 6)
    expect(record.Cotacao).toBe(162.4)
    expect(record.Posicao).toBeCloseTo(80 * 162.4, 6)
    expect(record.Segmento).toBe('Logística')
  })

  it('replaces quantity and average price in "set" mode', () => {
    const { workspace: ws } = runOperations(workspace({ fiis: [hglg] }), 'p1', [
      { type: 'upsert_asset', ticker: 'HGLG11', category: 'FIIs', quantity: 10, avgPrice: 150, mode: 'set' },
    ])
    expect(ws.portfolios[0].data.fiis[0]).toMatchObject({ Quantidade: 10, PrecoMedio: 150, Cotacao: 162.4 })
  })

  it('stores Tesouro and Renda Fixa with their own name fields', () => {
    const { workspace: ws } = runOperations(workspace(), 'p1', [
      { type: 'upsert_asset', ticker: 'Tesouro Selic 2029', category: 'Tesouro Direto', quantity: 1.1, avgPrice: 14600, mode: 'add' },
      { type: 'upsert_asset', ticker: 'CDB BTG 112% CDI', category: 'Renda Fixa', quantity: 1, avgPrice: 5000, mode: 'add' },
    ])
    expect(ws.portfolios[0].data.tesouro[0]).toMatchObject({ Titulo: 'Tesouro Selic 2029', Vencimento: '-' })
    expect(ws.portfolios[0].data.renda_fixa[0]).toMatchObject({ Ativo: 'CDB BTG 112% CDI', Indexador: '-' })
  })

  it('stores custom-category assets in manualAssets with Categoria and an id', () => {
    const { workspace: ws } = runOperations(workspace(), 'p1', [
      { type: 'upsert_asset', ticker: 'ETH', category: 'cripto', quantity: 2, avgPrice: 10, mode: 'add' },
    ])
    const record = ws.portfolios[0].data.manualAssets[0]
    expect(record).toMatchObject({ Ticker: 'ETH', Categoria: 'Cripto', Segmento: 'Cripto', Posicao: 20 })
    expect(typeof record.id).toBe('string')
  })

  it('removes an asset and recomputes totals', () => {
    const { workspace: ws, errors } = runOperations(workspace({ fiis: [hglg] }), 'p1', [{ type: 'remove_asset', ticker: 'hglg11' }])
    expect(errors).toEqual([])
    expect(ws.portfolios[0].data.fiis).toEqual([])
    expect(ws.portfolios[0].data.total_live).toBe(0)
  })

  it('moves an asset to another category, changing section', () => {
    const { workspace: ws } = runOperations(workspace({ fiis: [{ ...hglg, Ticker: 'TAEE11' }] }), 'p1', [
      { type: 'move_asset', ticker: 'TAEE11', category: 'Ações' },
    ])
    expect(ws.portfolios[0].data.fiis).toEqual([])
    expect(ws.portfolios[0].data.acoes[0]).toMatchObject({ Ticker: 'TAEE11', Quantidade: 60, Segmento: 'Ações' })
  })

  it.each([
    [{ type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: -1, avgPrice: 1, mode: 'add' }, 'Quantidade inválida'],
    [{ type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: NaN, avgPrice: 1, mode: 'add' }, 'Quantidade inválida'],
    [{ type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: 1, avgPrice: -5, mode: 'add' }, 'Preço médio inválido'],
    [{ type: 'upsert_asset', ticker: ' ', category: 'Ações', quantity: 1, avgPrice: 1, mode: 'add' }, 'Ticker vazio'],
    [{ type: 'upsert_asset', ticker: 'X', category: 'ETFs', quantity: 1, avgPrice: 1, mode: 'add' }, 'não existe'],
    [{ type: 'remove_asset', ticker: 'NADA3' }, 'não existe na carteira'],
    [{ type: 'move_asset', ticker: 'NADA3', category: 'Ações' }, 'não existe na carteira'],
  ] as const)('rejects invalid asset operation %#', (op, message) => {
    const before = workspace()
    const { workspace: ws, errors } = runOperations(before, 'p1', [op])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain(message)
    expect(ws).toEqual(before)
  })

  it('reports an error when the target portfolio does not exist', () => {
    const { errors } = runOperations(workspace(), 'gone', [
      { type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: 1, avgPrice: 1, mode: 'add' },
    ])
    expect(errors[0]).toContain('Carteira de destino não encontrada')
  })

  it('keeps applying valid operations after an invalid one', () => {
    const { workspace: ws, errors } = runOperations(workspace(), 'p1', [
      { type: 'remove_asset', ticker: 'NADA3' },
      { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 30, mode: 'add' },
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/^Operação 1 \(remove_asset\)/)
    expect(ws.portfolios[0].data.acoes).toHaveLength(1)
  })
})

describe('runOperations — categories', () => {
  it('adds a category and lets a later operation in the same batch use it', () => {
    const { workspace: ws, errors } = runOperations(workspace(), 'p1', [
      { type: 'add_category', name: 'ETFs' },
      { type: 'upsert_asset', ticker: 'IVVB11', category: 'ETFs', quantity: 10, avgPrice: 300, mode: 'add' },
    ])
    expect(errors).toEqual([])
    expect(ws.categories).toContain('ETFs')
    expect(ws.portfolios[0].data.manualAssets[0]).toMatchObject({ Ticker: 'IVVB11', Categoria: 'ETFs' })
  })

  it('rejects a duplicate category regardless of case', () => {
    expect(runOperations(workspace(), 'p1', [{ type: 'add_category', name: 'cripto' }]).errors[0]).toContain('já existe')
  })

  it('renames a custom category in every portfolio', () => {
    const { workspace: ws, errors } = runOperations(workspace({ manualAssets: [btc] }, { manualAssets: [{ ...btc, id: 'm2' }] }), 'p1', [
      { type: 'rename_category', from: 'Cripto', to: 'Criptomoedas' },
    ])
    expect(errors).toEqual([])
    expect(ws.categories).toEqual(['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'Criptomoedas'])
    expect(ws.portfolios[0].data.manualAssets[0].Categoria).toBe('Criptomoedas')
    expect(ws.portfolios[1].data.manualAssets[0].Categoria).toBe('Criptomoedas')
  })

  it('refuses to rename or remove built-in categories', () => {
    const { errors } = runOperations(workspace(), 'p1', [
      { type: 'rename_category', from: 'FIIs', to: 'Fundos' },
      { type: 'remove_category', name: 'Ações' },
    ])
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('embutida')
    expect(errors[1]).toContain('embutida')
  })

  it('removes an empty custom category', () => {
    const { workspace: ws, errors } = runOperations(workspace(), 'p1', [{ type: 'remove_category', name: 'Cripto' }])
    expect(errors).toEqual([])
    expect(ws.categories).not.toContain('Cripto')
  })

  it('requires moveTo when the category still has assets in any portfolio', () => {
    const { errors } = runOperations(workspace({}, { manualAssets: [btc] }), 'p1', [{ type: 'remove_category', name: 'Cripto' }])
    expect(errors[0]).toContain('moveTo')
  })

  it('moves assets to moveTo before removing the category', () => {
    const { workspace: ws, errors } = runOperations(workspace({ manualAssets: [btc] }), 'p1', [
      { type: 'remove_category', name: 'Cripto', moveTo: 'Ações' },
    ])
    expect(errors).toEqual([])
    expect(ws.portfolios[0].data.manualAssets).toEqual([])
    expect(ws.portfolios[0].data.acoes[0]).toMatchObject({ Ticker: 'BTC', Quantidade: 1, Cotacao: 150 })
  })
})

describe('describeOperations', () => {
  it('labels each row with what will happen', () => {
    const rows = describeOperations(workspace({ fiis: [hglg], manualAssets: [btc] }), 'p1', [
      { type: 'upsert_asset', ticker: 'bbse3', category: 'Ações', quantity: 200, avgPrice: 33.1, mode: 'add' },
      { type: 'upsert_asset', ticker: 'hglg11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'add' },
      { type: 'upsert_asset', ticker: 'HGLG11', category: 'FIIs', quantity: 5, avgPrice: 100, mode: 'set' },
      { type: 'move_asset', ticker: 'BTC', category: 'Ações' },
      { type: 'remove_asset', ticker: 'HGLG11' },
      { type: 'add_category', name: 'ETFs' },
      { type: 'rename_category', from: 'ETFs', to: 'Fundos de Índice' },
      { type: 'remove_category', name: 'Cripto', moveTo: 'Ações' },
    ])
    expect(rows).toEqual([
      { label: 'BBSE3', category: 'Ações', quantity: 200, avgPrice: 33.1, mode: 'novo' },
      { label: 'HGLG11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'somar' },
      { label: 'HGLG11', category: 'FIIs', quantity: 5, avgPrice: 100, mode: 'substituir' },
      { label: 'BTC', category: 'Ações', mode: 'mover' },
      { label: 'HGLG11', category: 'FIIs', quantity: 5, mode: 'remover' },
      { label: 'ETFs', category: 'ETFs', mode: 'nova categoria' },
      { label: 'ETFs → Fundos de Índice', category: 'Fundos de Índice', mode: 'renomear' },
      { label: 'Cripto', category: 'Ações', mode: 'excluir categoria' },
    ])
  })

  it('marks the second upsert of the same new ticker as "somar"', () => {
    const rows = describeOperations(workspace(), 'p1', [
      { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 30, mode: 'add' },
      { type: 'upsert_asset', ticker: 'itub4', category: 'Ações', quantity: 2, avgPrice: 31, mode: 'add' },
    ])
    expect(rows.map((r) => r.mode)).toEqual(['novo', 'somar'])
  })
})
