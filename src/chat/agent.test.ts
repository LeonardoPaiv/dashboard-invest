import { describe, expect, it, vi } from 'vitest'
import { OpenRouterError, type AssistantMessage, type ChatCompletionParams } from '../lib/openrouter/client'
import { createEmptyPortfolioData } from '../store/useInvestmentStore'
import { runAgentTurn } from './agent'
import type { ExtraAmortizationConfig, FinancingParameters } from '../types/financing'
import { buildSystemPrompt } from './systemPrompt'
import { TOOL_DEFINITIONS, type ToolContext } from './tools'

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

const main = {
  id: 'p1',
  name: 'Carteira Principal',
  data: createEmptyPortfolioData(),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const toolContext = (): ToolContext => ({
  workspace: {
    portfolios: [main],
    categories: ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto'],
  },
  viewData: createEmptyPortfolioData(),
  viewLabel: 'Carteira Principal',
  targetPortfolioId: 'p1',
  allocationTargets: {},
  createId: () => 'prop-1',
  currentPage: 'dashboard',
  navigate: vi.fn(),
  selectPortfolio: vi.fn(),
  app: {
    portfolios: [main],
    activePortfolioId: 'p1',
    settings: { estrategia: '', alvos: { fiis: 30, acoes: 40, renda_fixa: 30 } },
    contributionAmount: 1000,
    monthlyPlan: { incomes: [], expenses: [], categories: ['Outros'] },
    financing: { params, extraConfig, selectedPresetId: null },
    projection: { monthlyContribution: 1000, annualRate: 10, years: 10 },
  },
  monthlyHistory: [],
})

const call = (id: string, name: string, args: unknown) => ({
  id,
  type: 'function' as const,
  function: { name, arguments: JSON.stringify(args) },
})

const scripted = (...replies: AssistantMessage[]) => {
  const complete = vi.fn<(params: ChatCompletionParams) => Promise<AssistantMessage>>()
  replies.forEach((reply) => complete.mockResolvedValueOnce(reply))
  return complete
}

const base = { apiKey: 'k', model: 'm/x', history: [], userContent: 'oi', toolContext: toolContext() }

describe('runAgentTurn', () => {
  it('returns the reply when the model answers without tools', async () => {
    const complete = scripted({ role: 'assistant', content: ' Olá! ' })
    const result = await runAgentTurn({ ...base, complete })
    expect(result.reply).toBe('Olá!')
    expect(result.proposals).toEqual([])
    expect(result.history).toEqual([
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: ' Olá! ' },
    ])
    expect(complete).toHaveBeenCalledWith({
      apiKey: 'k',
      model: 'm/x',
      tools: TOOL_DEFINITIONS,
      messages: [
        { role: 'system', content: buildSystemPrompt('dashboard') },
        { role: 'user', content: 'oi' },
      ],
    })
  })

  it('keeps earlier history ahead of the new user message', async () => {
    const history = [
      { role: 'user' as const, content: 'antes' },
      { role: 'assistant' as const, content: 'resposta' },
    ]
    const complete = scripted({ role: 'assistant', content: 'ok' })
    const result = await runAgentTurn({ ...base, history, complete })
    expect(result.history.slice(0, 3)).toEqual([...history, { role: 'user', content: 'oi' }])
  })

  it('executes tool calls, feeds results back and collects proposals', async () => {
    const complete = scripted(
      { role: 'assistant', content: null, tool_calls: [call('c1', 'get_portfolio', {})] },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          call('c2', 'propose_changes', {
            summary: 'Compra',
            operations: [{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 30 }],
          }),
        ],
      },
      { role: 'assistant', content: 'Prévia pronta.' },
    )
    const result = await runAgentTurn({ ...base, complete })
    expect(complete).toHaveBeenCalledTimes(3)
    expect(result.reply).toBe('Prévia pronta.')
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0]).toMatchObject({ id: 'prop-1', status: 'pending' })
    expect(result.history.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant', 'tool', 'assistant'])
    expect(result.history[2]).toMatchObject({ role: 'tool', tool_call_id: 'c1' })
    const thirdCallMessages = complete.mock.calls[2][0].messages
    expect(thirdCallMessages[thirdCallMessages.length - 1]).toMatchObject({ role: 'tool', tool_call_id: 'c2' })
  })

  it('uses a default reply when the model ends with a proposal and no text', async () => {
    const complete = scripted(
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          call('c1', 'propose_changes', {
            summary: 's',
            operations: [{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 1 }],
          }),
        ],
      },
      { role: 'assistant', content: null },
    )
    expect((await runAgentTurn({ ...base, complete })).reply).toBe('Confira a prévia abaixo antes de salvar.')
  })

  it('stops after maxSteps with an explanation', async () => {
    const looping: AssistantMessage = { role: 'assistant', content: null, tool_calls: [call('c', 'get_portfolio', {})] }
    const complete = vi.fn().mockResolvedValue(looping)
    const result = await runAgentTurn({ ...base, complete, maxSteps: 2 })
    expect(complete).toHaveBeenCalledTimes(2)
    expect(result.reply).toBe('Parei depois de várias etapas sem concluir. Tente reformular o pedido.')
  })

  it('propagates API errors to the caller', async () => {
    const complete = vi.fn().mockRejectedValue(new OpenRouterError('Invalid credentials', 401))
    await expect(runAgentTurn({ ...base, complete })).rejects.toMatchObject({ status: 401 })
  })

  it('handles tool call without function field', async () => {
    const complete = scripted(
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'c1', type: 'function' as const, function: { name: 'get_portfolio', arguments: '{}' } },
          { id: 'c2', type: 'function' as const } as any, // missing function
          { role: 'assistant', content: 'Done' },
        ] as any,
      },
      { role: 'assistant', content: 'ok' },
    )
    const result = await runAgentTurn({ ...base, complete })
    expect(result.history.filter((m) => m.role === 'tool')).toHaveLength(2)
    const toolMessages = result.history.filter((m) => m.role === 'tool')
    expect(toolMessages[1]).toMatchObject({ tool_call_id: 'c2' })
    expect(JSON.parse(toolMessages[1].content)).toEqual({ ok: false, errors: ['Chamada de ferramenta malformada.'] })
  })

  it('skips tool call without id field', async () => {
    const complete = scripted(
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'c1', type: 'function' as const, function: { name: 'get_portfolio', arguments: '{}' } },
          { type: 'function' as const, function: { name: 'get_portfolio', arguments: '{}' } } as any, // missing id
        ],
      },
      { role: 'assistant', content: 'ok' },
    )
    const result = await runAgentTurn({ ...base, complete })
    const toolMessages = result.history.filter((m) => m.role === 'tool')
    expect(toolMessages).toHaveLength(1)
    expect(toolMessages[0]).toMatchObject({ tool_call_id: 'c1' })
  })

  it('handles arguments as an already-parsed object', async () => {
    const complete = scripted(
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'c1',
            type: 'function' as const,
            function: { name: 'propose_changes', arguments: { summary: 's', operations: [{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 1 }] } } as any,
          },
        ],
      },
      { role: 'assistant', content: 'ok' },
    )
    const result = await runAgentTurn({ ...base, complete })
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0].id).toBe('prop-1')
  })

  it('handles tool call with non-string name', async () => {
    const complete = scripted(
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'c1', type: 'function' as const, function: { name: 123, arguments: '{}' } } as any,
        ],
      },
      { role: 'assistant', content: 'ok' },
    )
    const result = await runAgentTurn({ ...base, complete })
    const toolMessages = result.history.filter((m) => m.role === 'tool')
    expect(toolMessages).toHaveLength(1)
    expect(JSON.parse(toolMessages[0].content)).toEqual({ ok: false, errors: ['Chamada de ferramenta malformada.'] })
  })

  it('resolves a tool-context factory again for every tool call', async () => {
    const factory = vi.fn(toolContext)
    const complete = scripted(
      { role: 'assistant', content: null, tool_calls: [call('c1', 'get_portfolio', {}), call('c2', 'get_portfolio', {})] },
      { role: 'assistant', content: 'ok' },
    )
    await runAgentTurn({ ...base, toolContext: factory, complete })
    expect(factory.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
