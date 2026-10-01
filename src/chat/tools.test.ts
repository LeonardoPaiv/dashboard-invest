import { describe, expect, it, vi } from 'vitest'
import { createEmptyPortfolioData, type Portfolio, type PortfolioData } from '../store/useInvestmentStore'
import type { ExtraAmortizationConfig, FinancingParameters } from '../types/financing'
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

const params: FinancingParameters = {
  propertyValue: 500000, appraisalValue: 500000, useCustomAppraisal: false, downPayment: 100000, termMonths: 360,
  annualInterestRateNominal: 10, amortizationType: 'SAC', indexerType: 'TR', monthlyIndexerRate: 0.08,
  financeInitialExpenses: false, itbiPercent: 3, registryFeePercent: 1, appraisalFeeFixed: 3500, applySFHDiscount: true,
  borrowerAge: 32, dfiMonthlyRate: 0.01, tcaMonthlyFixed: 25, useCustomMipRate: false, customMipRate: 0.028,
  monthlyGrossIncome: 16000,
}
const extraConfig: ExtraAmortizationConfig = {
  enabled: false, mode: 'constant', recalculation: 'prazo', monthlyAmount: 1500, targetInstallment: 2000,
  periodStartMonth: 1, periodEndMonth: 60, lumpSums: [],
}

const context = (): ToolContext => {
  const main = portfolio('p1', 'Carteira Principal', { fiis: [hglg], acoes: [itub] })
  return {
    workspace: { portfolios: [main], categories: ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'Cripto'] },
    viewData: main.data,
    viewLabel: 'Carteira Principal',
    targetPortfolioId: 'p1',
    allocationTargets: { fiis: 30, acoes: 40, renda_fixa: 30 },
    createId: () => 'prop-1',
    currentPage: 'dashboard',
    navigate: vi.fn(),
    selectPortfolio: vi.fn(),
    app: {
      portfolios: [main],
      activePortfolioId: 'p1',
      settings: { estrategia: '', alvos: { fiis: 30, acoes: 40, renda_fixa: 30 } },
      contributionAmount: 1000,
      monthlyPlan: {
        incomes: [{ id: 'i1', name: 'Salário', value: 8000, category: 'Salário' }],
        expenses: [{ id: 'e1', name: 'Aluguel', value: 2000, category: 'Aluguel' }],
        categories: ['Salário', 'Aluguel', 'Outros'],
      },
      financing: { params, extraConfig, selectedPresetId: 'sfh_caixa_sac' },
      projection: { monthlyContribution: 1000, annualRate: 10, years: 10 },
    },
    monthlyHistory: [],
  }
}

describe('TOOL_DEFINITIONS', () => {
  it('exposes the read, proposal, navigation and settings tools', () => {
    expect(TOOL_DEFINITIONS.map((t) => t.function.name)).toEqual(['get_portfolio', 'propose_changes', 'navigate', 'get_app_data', 'propose_settings'])
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
      page: 'dashboard',
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

  it('handles null in operations array', () => {
    const result = executeTool('propose_changes', JSON.stringify({ summary: 's', operations: [null, 5, 'x'] }), context())
    expect(result.proposal).toBeUndefined()
    const body = JSON.parse(result.content)
    expect(body.ok).toBe(false)
    expect(body.errors.length).toBe(3)
    expect(body.errors.every((e: string) => e.includes('tipo desconhecido'))).toBe(true)
  })

  it('handles null as operations argument', () => {
    const result = executeTool('propose_changes', JSON.stringify({ summary: 's', operations: null }), context())
    expect(result.proposal).toBeUndefined()
    expect(JSON.parse(result.content)).toEqual({ ok: false, errors: ['Informe ao menos uma operação em "operations".'] })
  })

  it('handles array as top-level argument', () => {
    const result = executeTool('propose_changes', JSON.stringify([1, 2, 3]), context())
    expect(result.proposal).toBeUndefined()
    expect(JSON.parse(result.content)).toEqual({ ok: false, errors: ['Informe ao menos uma operação em "operations".'] })
  })

  it('handles the string "null" as JSON argument', () => {
    const result = executeTool('propose_changes', 'null', context())
    expect(result.proposal).toBeUndefined()
    expect(JSON.parse(result.content)).toEqual({ ok: false, errors: ['Informe ao menos uma operação em "operations".'] })
  })

  it('handles number as rawArguments (untrusted input)', () => {
    const result = executeTool('propose_changes', 42 as any, context())
    expect(result.proposal).toBeUndefined()
    expect(JSON.parse(result.content)).toEqual({ ok: false, errors: ['Argumentos inválidos: não é um JSON válido.'] })
  })

  it('handles boolean as rawArguments (untrusted input)', () => {
    const result = executeTool('propose_changes', true as any, context())
    expect(result.proposal).toBeUndefined()
    expect(JSON.parse(result.content)).toEqual({ ok: false, errors: ['Argumentos inválidos: não é um JSON válido.'] })
  })

  it('accepts an object as rawArguments (already parsed by some providers)', () => {
    const result = executeTool(
      'propose_changes',
      { summary: 's', operations: [{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 1 }] } as any,
      context(),
    )
    expect(result.proposal).toBeDefined()
    expect(result.proposal?.id).toBe('prop-1')
  })

  it('handles internal tool error (wrapped in try/catch)', () => {
    const ctx = context()
    ctx.viewData = { acoes: 5 } as any
    const result = executeTool('get_portfolio', '{}', ctx)
    expect(result.proposal).toBeUndefined()
    expect(JSON.parse(result.content)).toEqual({ ok: false, errors: ['Erro interno ao executar a ferramenta.'] })
  })
})

describe('executeTool — navigate', () => {
  it('navigates to a known page', () => {
    const ctx = context()
    const result = executeTool('navigate', '{"page":"financiamento"}', ctx)
    expect(ctx.navigate).toHaveBeenCalledWith('financiamento')
    expect(ctx.selectPortfolio).not.toHaveBeenCalled()
    expect(JSON.parse(result.content)).toEqual({ ok: true, page: 'financiamento', label: 'Financiamento' })
  })
  it('switches the displayed portfolio by name, case-insensitively, and accepts "todas"', () => {
    const ctx = context()
    executeTool('navigate', '{"page":"dashboard","portfolio":"carteira principal"}', ctx)
    expect(ctx.selectPortfolio).toHaveBeenCalledWith('p1')
    executeTool('navigate', '{"page":"dashboard","portfolio":"Todas"}', ctx)
    expect(ctx.selectPortfolio).toHaveBeenLastCalledWith('all')
  })
  it('rejects unknown pages and portfolios without side effects', () => {
    const ctx = context()
    expect(JSON.parse(executeTool('navigate', '{"page":"lua"}', ctx).content).ok).toBe(false)
    const bad = JSON.parse(executeTool('navigate', '{"page":"dashboard","portfolio":"Inexistente"}', ctx).content)
    expect(bad).toEqual({ ok: false, errors: ['Carteira "Inexistente" não encontrada.'] })
    expect(ctx.navigate).not.toHaveBeenCalled()
    expect(ctx.selectPortfolio).not.toHaveBeenCalled()
  })
})

describe('executeTool — get_app_data', () => {
  it('returns only the requested sections', () => {
    const data = JSON.parse(executeTool('get_app_data', '{"sections":["plano_mensal","projecao"]}', context()).content)
    expect(Object.keys(data).sort()).toEqual(['currentPage', 'plano_mensal', 'projecao'])
    expect(data.plano_mensal).toMatchObject({ totalIncome: 8000, totalExpense: 2000, balance: 6000 })
    expect(data.projecao).toMatchObject({ monthlyContribution: 1000, annualRate: 10, years: 10 })
    expect(typeof data.projecao.estimatedFinalValue).toBe('number')
  })
  it('returns every section when none is requested and summarises the financing', () => {
    const data = JSON.parse(executeTool('get_app_data', '{}', context()).content)
    expect(Object.keys(data).sort()).toEqual(['carteiras', 'currentPage', 'estrategia', 'financiamento', 'historico', 'plano_mensal', 'projecao'])
    expect(data.carteiras).toEqual([{ name: 'Carteira Principal', active: true, assets: 2, total: 12000 }])
    expect(data.financiamento.params.termMonths).toBe(360)
    expect(data.financiamento.summary.financedAmount).toBeGreaterThan(0)
    expect(data.financiamento.presets.map((p: { id: string }) => p.id)).toContain('mcmv_social')
  })
  it('rejects unknown sections', () => {
    expect(JSON.parse(executeTool('get_app_data', '{"sections":["senha"]}', context()).content).ok).toBe(false)
  })
})

describe('executeTool — propose_settings', () => {
  it('builds a pending settings proposal with preview rows and the owning page', () => {
    const result = executeTool(
      'propose_settings',
      JSON.stringify({ summary: 'Prazo menor.', operations: [{ type: 'update_financing', params: { termMonths: 300 } }] }),
      context(),
    )
    expect(result.proposal).toMatchObject({
      id: 'prop-1', status: 'pending', page: 'financiamento', portfolioId: '', portfolioName: 'Financiamento',
      summary: 'Prazo menor.', operations: [], rows: [],
      settings: {
        operations: [{ type: 'update_financing', params: { termMonths: 300 } }],
        rows: [{ label: 'Prazo (meses)', before: '360', after: '300', mode: 'alterar' }],
      },
    })
    expect(JSON.parse(result.content)).toMatchObject({ ok: true, proposalId: 'prop-1', status: 'pending_user_confirmation' })
  })
  it('returns validation errors to the model without a proposal', () => {
    const result = executeTool(
      'propose_settings',
      JSON.stringify({ summary: 'x', operations: [{ type: 'set_contribution', amount: '1.234,56' }, { type: 'voar' }, 7] }),
      context(),
    )
    expect(result.proposal).toBeUndefined()
    expect(JSON.parse(result.content)).toEqual({
      ok: false,
      errors: ['Operação 2: tipo desconhecido "voar".', 'Operação 3: tipo desconhecido "7".'],
    })
    const second = executeTool('propose_settings', JSON.stringify({ summary: 'x', operations: [{ type: 'set_contribution', amount: '1.234,56' }] }), context())
    expect(JSON.parse(second.content).errors).toEqual(['Operação 1 (set_contribution): Valor do aporte inválido.'])
    expect(JSON.parse(executeTool('propose_settings', '{"summary":"x","operations":[]}', context()).content).ok).toBe(false)
  })
})

describe('executeTool — propose_changes with an explicit portfolio', () => {
  it('targets the named portfolio and tags the dashboard page', () => {
    const ctx = context()
    ctx.workspace.portfolios.push(portfolio('p2', 'Viagem'))
    const args = { summary: 's', portfolio: 'viagem', operations: [{ type: 'upsert_asset', ticker: 'PETR4', category: 'Ações', quantity: 1, avgPrice: 30 }] }
    const result = executeTool('propose_changes', JSON.stringify(args), ctx)
    expect(result.proposal).toMatchObject({ portfolioId: 'p2', portfolioName: 'Viagem', page: 'dashboard' })
    const missing = executeTool('propose_changes', JSON.stringify({ ...args, portfolio: 'Nada' }), ctx)
    expect(JSON.parse(missing.content)).toEqual({ ok: false, errors: ['Carteira "Nada" não encontrada.'] })
  })
})
