import { describe, expect, it } from 'vitest'
import { createEmptyPortfolioData, type Portfolio } from '../store/useInvestmentStore'
import { brl } from '../lib/format'
import type { ExtraAmortizationConfig, FinancingParameters } from '../types/financing'
import { pageOfOperations, runSettingsOperations, type SettingsOperation, type SettingsSnapshot } from './settingsOperations'

const portfolio = (id: string, name: string): Portfolio => ({
  id, name, color: '#6366f1', data: createEmptyPortfolioData(),
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})

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

const snapshot = (overrides: Partial<SettingsSnapshot> = {}): SettingsSnapshot => ({
  portfolios: [portfolio('p1', 'Carteira Principal'), portfolio('p2', 'Viagem')],
  activePortfolioId: 'p1',
  settings: { estrategia: '', alvos: { fiis: 33.3, acoes: 33.3, renda_fixa: 33.4 } },
  contributionAmount: 1000,
  monthlyPlan: {
    incomes: [{ id: 'i1', name: 'Salário', value: 8000, category: 'Salário' }],
    expenses: [{ id: 'e1', name: 'Aluguel', value: 2000, category: 'Aluguel' }],
    categories: ['Salário', 'Aluguel', 'Outros'],
  },
  financing: { params, extraConfig, selectedPresetId: 'sfh_caixa_sac' },
  projection: { monthlyContribution: 1000, annualRate: 10, years: 10 },
  ...overrides,
})

const run = (ops: SettingsOperation[], base = snapshot()) => runSettingsOperations(base, ops, () => 'new-id')
const firstError = (ops: SettingsOperation[], base = snapshot()) => run(ops, base).errors[0]

describe('portfolios', () => {
  it('creates a portfolio and makes it the active one', () => {
    const { snapshot: next, errors, rows } = run([{ type: 'create_portfolio', name: ' Cripto ' }])
    expect(errors).toEqual([])
    expect(next.portfolios.map((p) => [p.id, p.name])).toContainEqual(['new-id', 'Cripto'])
    expect(next.activePortfolioId).toBe('new-id')
    expect(rows).toEqual([{ label: 'Carteira Cripto', after: 'vazia', mode: 'criar' }])
  })
  it('rejects empty and duplicate names', () => {
    expect(firstError([{ type: 'create_portfolio', name: ' ' }])).toBe('Operação 1 (create_portfolio): Nome da carteira vazio.')
    expect(firstError([{ type: 'create_portfolio', name: 'viagem' }])).toBe('Operação 1 (create_portfolio): A carteira "viagem" já existe.')
  })
  it('renames by current name', () => {
    const { snapshot: next, rows } = run([{ type: 'rename_portfolio', portfolio: 'viagem', name: 'Férias' }])
    expect(next.portfolios[1].name).toBe('Férias')
    expect(rows).toEqual([{ label: 'Carteira', before: 'Viagem', after: 'Férias', mode: 'alterar' }])
  })
  it('deletes a portfolio and moves the active view off it', () => {
    const { snapshot: next, rows } = run([{ type: 'delete_portfolio', portfolio: 'Carteira Principal' }])
    expect(next.portfolios.map((p) => p.id)).toEqual(['p2'])
    expect(next.activePortfolioId).toBe('p2')
    expect(rows[0]).toMatchObject({ label: 'Carteira Carteira Principal', mode: 'remover' })
  })
  it('keeps the consolidated view when deleting under "all"', () => {
    const { snapshot: next } = run([{ type: 'delete_portfolio', portfolio: 'Viagem' }], snapshot({ activePortfolioId: 'all' }))
    expect(next.activePortfolioId).toBe('all')
  })
  it('refuses to delete the only portfolio or an unknown one', () => {
    const one = snapshot({ portfolios: [portfolio('p1', 'Carteira Principal')] })
    expect(firstError([{ type: 'delete_portfolio', portfolio: 'Carteira Principal' }], one)).toBe(
      'Operação 1 (delete_portfolio): Não é possível excluir a única carteira.',
    )
    expect(firstError([{ type: 'delete_portfolio', portfolio: 'X' }])).toBe('Operação 1 (delete_portfolio): Carteira "X" não encontrada.')
  })
})

describe('strategy', () => {
  it('sets targets that add up to 100', () => {
    const { snapshot: next, rows } = run([{ type: 'set_allocation_targets', fiis: 40, acoes: 40, renda_fixa: 20 }])
    expect(next.settings.alvos).toEqual({ fiis: 40, acoes: 40, renda_fixa: 20 })
    expect(rows).toContainEqual({ label: 'Meta FIIs', before: '33,3%', after: '40%', mode: 'alterar' })
    expect(rows).toHaveLength(3)
  })
  it('rejects targets that do not add up or are not numbers', () => {
    expect(firstError([{ type: 'set_allocation_targets', fiis: 50, acoes: 40, renda_fixa: 20 }])).toBe(
      'Operação 1 (set_allocation_targets): As metas precisam somar 100% (soma atual: 110).',
    )
    expect(firstError([{ type: 'set_allocation_targets', fiis: '40', acoes: 40, renda_fixa: 20 }])).toMatch(/Metas inválidas/)
  })
  it('sets the strategy text and the contribution', () => {
    const { snapshot: next, errors } = run([
      { type: 'set_strategy_text', text: 'Foco em dividendos' },
      { type: 'set_contribution', amount: 2500 },
    ])
    expect(errors).toEqual([])
    expect(next.settings.estrategia).toBe('Foco em dividendos')
    expect(next.contributionAmount).toBe(2500)
  })
  it('rejects a contribution sent as a formatted string', () => {
    expect(firstError([{ type: 'set_contribution', amount: '1.234,56' }])).toBe('Operação 1 (set_contribution): Valor do aporte inválido.')
  })
})

describe('monthly plan', () => {
  it('adds an item, creating its category when needed', () => {
    const { snapshot: next, rows } = run([{ type: 'add_monthly_item', kind: 'expense', name: 'Academia', value: 120, category: 'Saúde' }])
    expect(next.monthlyPlan.expenses).toContainEqual({ id: 'new-id', name: 'Academia', value: 120, category: 'Saúde' })
    expect(next.monthlyPlan.categories).toContain('Saúde')
    expect(rows).toContainEqual({ label: 'Despesa Academia', after: `${brl(120)} · Saúde`, mode: 'criar' })
  })
  it('defaults the category to Outros and rejects duplicates and bad values', () => {
    expect(run([{ type: 'add_monthly_item', kind: 'income', name: 'Freela', value: 500 }]).snapshot.monthlyPlan.incomes[1].category).toBe('Outros')
    expect(firstError([{ type: 'add_monthly_item', kind: 'expense', name: 'aluguel', value: 10 }])).toMatch(/Já existe uma despesa chamada "aluguel"/)
    expect(firstError([{ type: 'add_monthly_item', kind: 'expense', name: 'Luz', value: -1 }])).toBe('Operação 1 (add_monthly_item): Valor inválido para Luz.')
    expect(firstError([{ type: 'add_monthly_item', kind: 'x', name: 'Luz', value: 1 }])).toMatch(/Informe kind/)
  })
  it('updates and removes an item by name', () => {
    const { snapshot: next, errors } = run([
      { type: 'update_monthly_item', kind: 'expense', name: 'aluguel', value: 2300 },
      { type: 'remove_monthly_item', kind: 'income', name: 'Salário' },
    ])
    expect(errors).toEqual([])
    expect(next.monthlyPlan.expenses[0]).toMatchObject({ id: 'e1', name: 'Aluguel', value: 2300 })
    expect(next.monthlyPlan.incomes).toEqual([])
  })
  it('reports missing and ambiguous items', () => {
    expect(firstError([{ type: 'remove_monthly_item', kind: 'expense', name: 'Luz' }])).toBe(
      'Operação 1 (remove_monthly_item): Não existe despesa chamada "Luz".',
    )
    const twice = snapshot()
    twice.monthlyPlan.expenses.push({ id: 'e2', name: 'Aluguel', value: 1, category: 'Outros' })
    expect(firstError([{ type: 'update_monthly_item', kind: 'expense', name: 'Aluguel', value: 5 }], twice)).toMatch(/Há mais de um item/)
  })
  it('adds a category once', () => {
    expect(run([{ type: 'add_monthly_category', name: 'Pets' }]).snapshot.monthlyPlan.categories).toContain('Pets')
    expect(firstError([{ type: 'add_monthly_category', name: 'outros' }])).toMatch(/já existe no plano mensal/)
  })
})

describe('financing', () => {
  it('patches parameters, clears the preset and previews each change', () => {
    const { snapshot: next, rows, errors } = run([{ type: 'update_financing', params: { termMonths: 300, amortizationType: 'PRICE', applySFHDiscount: false } }])
    expect(errors).toEqual([])
    expect(next.financing.params).toMatchObject({ termMonths: 300, amortizationType: 'PRICE', applySFHDiscount: false, propertyValue: 500000 })
    expect(next.financing.selectedPresetId).toBeNull()
    expect(rows).toEqual([
      { label: 'Prazo (meses)', before: '360', after: '300', mode: 'alterar' },
      { label: 'Sistema de amortização', before: 'SAC', after: 'PRICE', mode: 'alterar' },
      { label: 'Desconto SFH em cartório', before: 'sim', after: 'não', mode: 'alterar' },
    ])
  })
  it('rejects unknown fields, out-of-range, fractional and string values', () => {
    expect(firstError([{ type: 'update_financing', params: { foo: 1 } }])).toBe('Operação 1 (update_financing): Campo desconhecido em financiamento: "foo".')
    expect(firstError([{ type: 'update_financing', params: { termMonths: 360.5 } }])).toMatch(/Prazo \(meses\): valor inválido \(360.5\); use um número inteiro entre 12 e 480\./)
    expect(firstError([{ type: 'update_financing', params: { propertyValue: '600.000,00' } }])).toMatch(/Valor do imóvel: valor inválido/)
    expect(firstError([{ type: 'update_financing', params: { indexerType: 'CDI' } }])).toMatch(/Indexador: use um de TR, IPCA, POUPANCA, PREFIXADO\./)
    expect(firstError([{ type: 'update_financing', params: { useCustomMipRate: 'yes' } }])).toMatch(/use true ou false/)
    expect(firstError([{ type: 'update_financing' }])).toMatch(/Informe os campos de financiamento a alterar\./)
    expect(firstError([{ type: 'update_financing', params: { termMonths: 360 } }])).toMatch(/Nada a alterar em financiamento/)
  })
  it('requires the down payment to stay below the property value', () => {
    expect(firstError([{ type: 'update_financing', params: { downPayment: 500000 } }])).toMatch(/A entrada precisa ser menor que o valor do imóvel\./)
  })
  it('applies a preset', () => {
    const { snapshot: next, rows } = run([{ type: 'apply_financing_preset', presetId: 'price_banco_privado' }])
    expect(next.financing.selectedPresetId).toBe('price_banco_privado')
    expect(next.financing.params).toMatchObject({ propertyValue: 600000, amortizationType: 'PRICE' })
    expect(rows).toEqual([{ label: 'Preset de financiamento', after: 'Tabela Price (Banco Privado)', mode: 'alterar' }])
    expect(firstError([{ type: 'apply_financing_preset', presetId: 'x' }])).toMatch(/Preset desconhecido: "x"/)
  })
  it('patches the extra amortization config and guards the period', () => {
    const { snapshot: next } = run([{ type: 'update_extra_amortization', config: { enabled: true, monthlyAmount: 2000 } }])
    expect(next.financing.extraConfig).toMatchObject({ enabled: true, monthlyAmount: 2000, lumpSums: [] })
    expect(firstError([{ type: 'update_extra_amortization', config: { periodStartMonth: 80 } }])).toMatch(/mês inicial precisa ser menor ou igual/)
    expect(firstError([{ type: 'update_extra_amortization', config: { lumpSums: [] } }])).toMatch(/Campo desconhecido em amortização extra: "lumpSums"/)
  })
  it('adds and removes lump sums by month', () => {
    const added = run([{ type: 'add_lump_sum', month: 12, amount: 10000 }])
    expect(added.snapshot.financing.extraConfig.lumpSums).toEqual([
      { id: 'new-id', month: 12, amount: 10000, recalculation: 'prazo', description: 'Aporte avulso' },
    ])
    expect(added.rows).toEqual([{ label: 'Aporte avulso mês 12', after: `${brl(10000)} · prazo`, mode: 'criar' }])
    const removed = run([{ type: 'remove_lump_sum', month: 12 }], added.snapshot)
    expect(removed.snapshot.financing.extraConfig.lumpSums).toEqual([])
    expect(firstError([{ type: 'remove_lump_sum', month: 3 }])).toBe('Operação 1 (remove_lump_sum): Não há aporte avulso no mês 3.')
    expect(firstError([{ type: 'add_lump_sum', month: 0, amount: 1 }])).toMatch(/Mês inválido/)
    expect(firstError([{ type: 'add_lump_sum', month: 1, amount: 0 }])).toMatch(/Valor inválido para o aporte avulso/)
  })
})

describe('projection and run semantics', () => {
  it('patches projection parameters', () => {
    const { snapshot: next, rows } = run([{ type: 'set_projection', annualRate: 12, years: 20 }])
    expect(next.projection).toEqual({ monthlyContribution: 1000, annualRate: 12, years: 20 })
    expect(rows).toHaveLength(2)
    expect(firstError([{ type: 'set_projection', years: 0 }])).toMatch(/Anos: valor inválido/)
  })
  it('keeps going after an error and never mutates its input', () => {
    const base = snapshot()
    const frozen = JSON.stringify(base)
    const { snapshot: next, errors } = run(
      [{ type: 'set_contribution', amount: -1 }, { type: 'set_contribution', amount: 700 }, { type: 'nope' } as unknown as SettingsOperation],
      base,
    )
    expect(errors).toEqual([
      'Operação 1 (set_contribution): Valor do aporte inválido.',
      'Operação 3 (nope): Tipo de operação desconhecido.',
    ])
    expect(next.contributionAmount).toBe(700)
    expect(JSON.stringify(base)).toBe(frozen)
  })
  it('names the page that owns the last operation', () => {
    expect(pageOfOperations([{ type: 'set_contribution', amount: 1 }])).toBe('strategy')
    expect(pageOfOperations([{ type: 'set_contribution', amount: 1 }, { type: 'add_lump_sum', month: 1, amount: 1 }])).toBe('financiamento')
    expect(pageOfOperations([{ type: 'create_portfolio', name: 'x' }])).toBe('dashboard')
    expect(pageOfOperations([{ type: 'add_monthly_category', name: 'x' }])).toBe('plano-mensal')
    expect(pageOfOperations([{ type: 'set_projection', years: 5 }])).toBe('projection')
  })

  it('treats null optional fields like absent ones', () => {
    const updated = run([{ type: 'update_monthly_item', kind: 'expense', name: 'Aluguel', value: 2300, category: null, newName: null }])
    expect(updated.errors).toEqual([])
    expect(updated.snapshot.monthlyPlan.expenses[0]).toMatchObject({ name: 'Aluguel', value: 2300, category: 'Aluguel' })
    expect(run([{ type: 'update_monthly_item', kind: 'expense', name: 'Aluguel', value: null, category: 'Moradia' }]).snapshot.monthlyPlan.expenses[0])
      .toMatchObject({ value: 2000, category: 'Moradia' })
    expect(run([{ type: 'add_monthly_item', kind: 'income', name: 'Freela', value: 500, category: null }]).snapshot.monthlyPlan.incomes[1].category).toBe('Outros')
    const lump = run([{ type: 'add_lump_sum', month: 12, amount: 5000, recalculation: null, description: null }])
    expect(lump.errors).toEqual([])
    expect(lump.snapshot.financing.extraConfig.lumpSums[0]).toMatchObject({ recalculation: 'prazo', description: 'Aporte avulso' })
    const projection = run([{ type: 'set_projection', years: 20, annualRate: null, monthlyContribution: null }])
    expect(projection.errors).toEqual([])
    expect(projection.snapshot.projection).toEqual({ monthlyContribution: 1000, annualRate: 10, years: 20 })
  })
})
