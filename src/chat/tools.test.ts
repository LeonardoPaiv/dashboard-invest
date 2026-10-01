import { describe, expect, it } from 'vitest'
import { createEmptyPortfolioData, type Portfolio, type PortfolioData } from '../store/useInvestmentStore'
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from './tools'

const portfolio = (id: string, name: string, data: Partial<PortfolioData> = {}): Portfolio => ({
  id,
  name,
  data: { ...createEmptyPortfolioData(), ...data },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const hglg = { Ticker: 'HGLG11', Quantidade: 60, PrecoMedio: 150, Cotacao: 160, Posicao: 9600, Segmento: 'Logística' }
const itub = { Ticker: 'ITUB4', Quantidade: 100, PrecoMedio: 20, Cotacao: 24, Posicao: 2400, Segmento: 'Bancos' }

const context = (): ToolContext => {
  const main = portfolio('p1', 'Carteira Principal', { fiis: [hglg], acoes: [itub] })
  return {
    workspace: { portfolios: [main], categories: ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'Cripto'] },
    viewData: main.data,
    viewLabel: 'Carteira Principal',
    targetPortfolioId: 'p1',
    allocationTargets: { fiis: 30, acoes: 40, renda_fixa: 30 },
    createId: () => 'prop-1',
  }
}

describe('TOOL_DEFINITIONS', () => {
  it('exposes exactly the read tool and the proposal tool', () => {
    expect(TOOL_DEFINITIONS.map((t) => t.function.name)).toEqual(['get_portfolio', 'propose_changes'])
  })
})

describe('executeTool — get_portfolio', () => {
  it('returns totals, categories with shares, assets and targets', () => {
    const result = executeTool('get_portfolio', '{}', context())
    expect(result.proposal).toBeUndefined()
    const snapshot = JSON.parse(result.content)
    expect(snapshot).toMatchObject({
      portfolio: 'Carteira Principal',
      changesWillBeSavedTo: 'Carteira Principal',
      total: 12000,
      allocationTargetsPct: { fiis: 30, acoes: 40, renda_fixa: 30 },
    })
    expect(snapshot.categories).toContainEqual({ name: 'FIIs', builtin: true, value: 9600, sharePct: 80 })
    expect(snapshot.categories).toContainEqual({ name: 'Cripto', builtin: false, value: 0, sharePct: 0 })
    expect(snapshot.assets).toContainEqual({
      ticker: 'ITUB4',
      category: 'Ações',
      quantity: 100,
      avgPrice: 20,
      price: 24,
      value: 2400,
    })
  })

  it('accepts empty arguments', () => {
    expect(JSON.parse(executeTool('get_portfolio', '', context()).content).total).toBe(12000)
  })
})

describe('executeTool — propose_changes', () => {
  const args = (operations: unknown[], summary = 'Importar extrato') => JSON.stringify({ summary, operations })

  it('creates a pending proposal with preview rows and does not touch the workspace', () => {
    const ctx = context()
    const result = executeTool(
      'propose_changes',
      args([
        { type: 'upsert_asset', ticker: 'bbse3', category: 'Ações', quantity: 200, avgPrice: 33.1 },
        { type: 'upsert_asset', ticker: 'hglg11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'add' },
      ]),
      ctx,
    )
    expect(result.proposal).toEqual({
      id: 'prop-1',
      portfolioId: 'p1',
      portfolioName: 'Carteira Principal',
      summary: 'Importar extrato',
      status: 'pending',
      operations: [
        { type: 'upsert_asset', ticker: 'bbse3', category: 'Ações', quantity: 200, avgPrice: 33.1, mode: 'add' },
        { type: 'upsert_asset', ticker: 'hglg11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'add' },
      ],
      rows: [
        { label: 'BBSE3', category: 'Ações', quantity: 200, avgPrice: 33.1, mode: 'novo' },
        { label: 'HGLG11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'somar' },
      ],
    })
    expect(JSON.parse(result.content)).toMatchObject({ ok: true, proposalId: 'prop-1', status: 'pending_user_confirmation' })
    expect(ctx.workspace.portfolios[0].data.acoes).toEqual([itub])
  })

  it.each([
    ['negative quantity', [{ type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: -1, avgPrice: 1 }], 'Quantidade inválida'],
    ['pt-BR number string', [{ type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: '1.234,56', avgPrice: 1 }], 'Quantidade inválida'],
    ['missing category', [{ type: 'upsert_asset', ticker: 'X', category: 'ETFs', quantity: 1, avgPrice: 1 }], 'não existe'],
    ['unknown operation type', [{ type: 'explode' }], 'tipo desconhecido'],
    ['unknown asset', [{ type: 'remove_asset', ticker: 'NADA3' }], 'não existe na carteira'],
  ])('returns errors to the model instead of a proposal: %s', (_label, operations, message) => {
    const result = executeTool('propose_changes', args(operations), context())
    expect(result.proposal).toBeUndefined()
    const body = JSON.parse(result.content)
    expect(body.ok).toBe(false)
    expect(body.errors.join(' ')).toContain(message)
  })

  it('requires at least one operation', () => {
    const body = JSON.parse(executeTool('propose_changes', args([]), context()).content)
    expect(body).toEqual({ ok: false, errors: ['Informe ao menos uma operação em "operations".'] })
  })

  it('reports malformed JSON arguments', () => {
    const result = executeTool('propose_changes', '{"summary": "x", "operations": [', context())
    expect(result.proposal).toBeUndefined()
    expect(JSON.parse(result.content)).toEqual({ ok: false, errors: ['Argumentos inválidos: não é um JSON válido.'] })
  })

  it('reports unknown tools', () => {
    expect(JSON.parse(executeTool('delete_everything', '{}', context()).content)).toEqual({
      ok: false,
      errors: ['Ferramenta desconhecida: delete_everything.'],
    })
  })

  it('names the portfolio that will receive the changes', () => {
    const ctx = context()
    ctx.workspace.portfolios.push(portfolio('p2', 'Aposentadoria'))
    ctx.targetPortfolioId = 'p2'
    const result = executeTool(
      'propose_changes',
      args([{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 30 }]),
      ctx,
    )
    expect(result.proposal).toMatchObject({ portfolioId: 'p2', portfolioName: 'Aposentadoria' })
    expect(result.proposal?.rows[0].mode).toBe('novo')
  })
})
