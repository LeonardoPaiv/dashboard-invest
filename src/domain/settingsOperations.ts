import { brl, num } from '../lib/format'
import { FINANCING_PRESETS } from '../store/useFinancingStore'
import { createEmptyPortfolioData, type MonthlyItem, type MonthlyPlan, type Portfolio } from '../store/useInvestmentStore'
import type { AmortizationRecalculation, ExtraAmortizationConfig, FinancingParameters } from '../types/financing'
import { SECTIONS } from './assets'
import type { PageId } from './pages'

export interface ProjectionParams { monthlyContribution: number; annualRate: number; years: number }
export interface AllocationTargets { fiis: number; acoes: number; renda_fixa: number }

export interface SettingsSnapshot {
  portfolios: Portfolio[]
  activePortfolioId: string
  settings: { estrategia: string; alvos: AllocationTargets }
  contributionAmount: number
  monthlyPlan: MonthlyPlan
  financing: { params: FinancingParameters; extraConfig: ExtraAmortizationConfig; selectedPresetId: string | null }
  projection: ProjectionParams
}

export const SETTINGS_OPERATION_TYPES = [
  'create_portfolio', 'rename_portfolio', 'delete_portfolio',
  'set_allocation_targets', 'set_strategy_text', 'set_contribution',
  'add_monthly_item', 'update_monthly_item', 'remove_monthly_item', 'add_monthly_category',
  'update_financing', 'apply_financing_preset', 'update_extra_amortization', 'add_lump_sum', 'remove_lump_sum',
  'set_projection',
] as const
export type SettingsOperationType = (typeof SETTINGS_OPERATION_TYPES)[number]

/** Vem do modelo: só `type` é garantido; cada campo é validado ao aplicar. */
export interface SettingsOperation { type: SettingsOperationType; [field: string]: unknown }

export interface SettingsPreviewRow { label: string; before?: string; after?: string; mode: 'criar' | 'alterar' | 'remover' }

export interface SettingsRunResult { snapshot: SettingsSnapshot; errors: string[]; rows: SettingsPreviewRow[] }

const PORTFOLIO_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#3b82f6']

type FieldRule = { label: string } & (
  | { kind: 'number'; min: number; max: number; integer?: boolean }
  | { kind: 'boolean' }
  | { kind: 'enum'; values: readonly string[] }
)

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const isNum = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const show = (value: unknown): string =>
  typeof value === 'boolean' ? (value ? 'sim' : 'não') : typeof value === 'number' ? num(value) : String(value ?? '—')

function patchFields<T extends object>(
  current: T,
  patch: unknown,
  rules: Record<string, FieldRule>,
  what: string,
): { next: T; rows: SettingsPreviewRow[] } {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length === 0) {
    throw new Error(`Informe os campos de ${what} a alterar.`)
  }
  const next = { ...current } as unknown as Record<string, unknown>
  const rows: SettingsPreviewRow[] = []
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const rule = Object.prototype.hasOwnProperty.call(rules, key) ? rules[key] : undefined
    if (!rule) throw new Error(`Campo desconhecido em ${what}: "${key}".`)
    if (rule.kind === 'number') {
      if (!isNum(value) || value < rule.min || value > rule.max || (rule.integer && !Number.isInteger(value))) {
        throw new Error(
          `${rule.label}: valor inválido (${String(value)}); use um número${rule.integer ? ' inteiro' : ''} entre ${rule.min} e ${rule.max}.`,
        )
      }
    } else if (rule.kind === 'boolean') {
      if (typeof value !== 'boolean') throw new Error(`${rule.label}: use true ou false.`)
    } else if (typeof value !== 'string' || !rule.values.includes(value)) {
      throw new Error(`${rule.label}: use um de ${rule.values.join(', ')}.`)
    }
    const before = (current as unknown as Record<string, unknown>)[key]
    if (before === value) continue
    rows.push({ label: rule.label, before: show(before), after: show(value), mode: 'alterar' })
    next[key] = value
  }
  if (rows.length === 0) throw new Error(`Nada a alterar em ${what}: os valores já são esses.`)
  return { next: next as T, rows }
}

const n = (label: string, min: number, max: number, integer?: boolean): FieldRule => ({ label, kind: 'number', min, max, integer })
const b = (label: string): FieldRule => ({ label, kind: 'boolean' })
const e = (label: string, values: readonly string[]): FieldRule => ({ label, kind: 'enum', values })

const FINANCING_RULES: Record<string, FieldRule> = {
  propertyValue: n('Valor do imóvel', 1, 1e9),
  appraisalValue: n('Valor de avaliação', 1, 1e9),
  useCustomAppraisal: b('Avaliação diferente da compra'),
  downPayment: n('Entrada', 0, 1e9),
  termMonths: n('Prazo (meses)', 12, 480, true),
  annualInterestRateNominal: n('Juros nominais (% a.a.)', 0, 100),
  amortizationType: e('Sistema de amortização', ['SAC', 'PRICE']),
  indexerType: e('Indexador', ['TR', 'IPCA', 'POUPANCA', 'PREFIXADO']),
  monthlyIndexerRate: n('Indexador (% a.m.)', 0, 10),
  financeInitialExpenses: b('Financiar custas iniciais'),
  itbiPercent: n('ITBI (%)', 0, 20),
  registryFeePercent: n('Cartório (%)', 0, 20),
  appraisalFeeFixed: n('Tarifa de avaliação', 0, 1e6),
  applySFHDiscount: b('Desconto SFH em cartório'),
  borrowerAge: n('Idade do proponente', 18, 80, true),
  dfiMonthlyRate: n('DFI (% a.m.)', 0, 5),
  tcaMonthlyFixed: n('Tarifa de administração', 0, 1e4),
  useCustomMipRate: b('Usar MIP personalizado'),
  customMipRate: n('MIP personalizado (% a.m.)', 0, 5),
  monthlyGrossIncome: n('Renda bruta mensal', 0, 1e9),
}

const EXTRA_RULES: Record<string, FieldRule> = {
  enabled: b('Amortização extra ativa'),
  mode: e('Modo de amortização', ['constant', 'target_installment', 'time_period', 'lump_sum']),
  recalculation: e('Recalcular', ['prazo', 'parcela']),
  monthlyAmount: n('Aporte mensal extra', 0, 1e9),
  targetInstallment: n('Parcela alvo', 0, 1e9),
  periodStartMonth: n('Mês inicial', 1, 480, true),
  periodEndMonth: n('Mês final', 1, 480, true),
}

const PROJECTION_RULES: Record<string, FieldRule> = {
  monthlyContribution: n('Aporte mensal', 0, 1e9),
  annualRate: n('Taxa anual (%)', 0, 100),
  years: n('Anos', 1, 60, true),
}

const OPERATION_PAGE: Record<SettingsOperationType, PageId> = {
  create_portfolio: 'dashboard', rename_portfolio: 'dashboard', delete_portfolio: 'dashboard',
  set_allocation_targets: 'strategy', set_strategy_text: 'strategy', set_contribution: 'strategy',
  add_monthly_item: 'plano-mensal', update_monthly_item: 'plano-mensal', remove_monthly_item: 'plano-mensal',
  add_monthly_category: 'plano-mensal',
  update_financing: 'financiamento', apply_financing_preset: 'financiamento', update_extra_amortization: 'financiamento',
  add_lump_sum: 'financiamento', remove_lump_sum: 'financiamento',
  set_projection: 'projection',
}

export function pageOfOperations(operations: SettingsOperation[]): PageId {
  const last = operations[operations.length - 1]
  return (last && OPERATION_PAGE[last.type]) || 'dashboard'
}

type Applied = { snapshot: SettingsSnapshot; rows: SettingsPreviewRow[] }

const findPortfolio = (s: SettingsSnapshot, name: unknown): Portfolio => {
  const found = s.portfolios.find((p) => sameName(p.name, str(name)))
  if (!found) throw new Error(`Carteira "${String(name)}" não encontrada.`)
  return found
}

function checkPortfolioName(s: SettingsSnapshot, raw: unknown): string {
  const name = str(raw)
  if (!name) throw new Error('Nome da carteira vazio.')
  if (s.portfolios.some((p) => sameName(p.name, name))) throw new Error(`A carteira "${name}" já existe.`)
  return name
}

function portfolioSummary(p: Portfolio): string {
  const data = p.data as unknown as Record<string, unknown[] | undefined>
  const count = SECTIONS.reduce((acc, section) => acc + (data[section]?.length ?? 0), 0)
  return `${count} ativos · ${brl(Number(p.data.total_live) || 0)}`
}

const kindOf = (raw: unknown): { key: 'incomes' | 'expenses'; noun: string; label: string } => {
  if (raw === 'income') return { key: 'incomes', noun: 'receita', label: 'Receita' }
  if (raw === 'expense') return { key: 'expenses', noun: 'despesa', label: 'Despesa' }
  throw new Error('Informe kind como "income" (receita) ou "expense" (despesa).')
}

const itemValue = (raw: unknown, name: string): number => {
  if (!isNum(raw) || raw <= 0) throw new Error(`Valor inválido para ${name}.`)
  return raw
}

const withCategory = (plan: MonthlyPlan, category: string): string[] =>
  plan.categories.some((c) => sameName(c, category)) ? plan.categories : [...plan.categories, category]

const canonicalCategory = (plan: MonthlyPlan, category: string): string =>
  plan.categories.find((c) => sameName(c, category)) ?? category

function locateItem(s: SettingsSnapshot, op: SettingsOperation) {
  const kind = kindOf(op.kind)
  const name = str(op.name)
  const matches = s.monthlyPlan[kind.key].filter((item) => sameName(item.name, name))
  if (matches.length === 0) throw new Error(`Não existe ${kind.noun} chamada "${name}".`)
  if (matches.length > 1) throw new Error(`Há mais de um item chamado "${name}"; ajuste direto no Plano Mensal.`)
  return { kind, item: matches[0] }
}

const itemSummary = (item: MonthlyItem) => `${brl(item.value)} · ${item.category}`

function applyOne(s: SettingsSnapshot, op: SettingsOperation, createId: () => string): Applied {
  switch (op.type) {
    case 'create_portfolio': {
      const name = checkPortfolioName(s, op.name)
      const now = new Date().toISOString()
      const portfolio: Portfolio = {
        id: createId(), name, color: PORTFOLIO_COLORS[s.portfolios.length % PORTFOLIO_COLORS.length],
        data: createEmptyPortfolioData(), createdAt: now, updatedAt: now,
      }
      return {
        snapshot: { ...s, portfolios: [...s.portfolios, portfolio], activePortfolioId: portfolio.id },
        rows: [{ label: `Carteira ${name}`, after: 'vazia', mode: 'criar' }],
      }
    }
    case 'rename_portfolio': {
      const target = findPortfolio(s, op.portfolio)
      const name = checkPortfolioName(s, op.name)
      return {
        snapshot: { ...s, portfolios: s.portfolios.map((p) => (p.id === target.id ? { ...p, name } : p)) },
        rows: [{ label: 'Carteira', before: target.name, after: name, mode: 'alterar' }],
      }
    }
    case 'delete_portfolio': {
      const target = findPortfolio(s, op.portfolio)
      if (s.portfolios.length <= 1) throw new Error('Não é possível excluir a única carteira.')
      const portfolios = s.portfolios.filter((p) => p.id !== target.id)
      return {
        snapshot: {
          ...s, portfolios,
          activePortfolioId: s.activePortfolioId === target.id ? portfolios[0].id : s.activePortfolioId,
        },
        rows: [{ label: `Carteira ${target.name}`, before: portfolioSummary(target), mode: 'remover' }],
      }
    }
    case 'set_allocation_targets': {
      const values = [op.fiis, op.acoes, op.renda_fixa]
      if (!values.every((v) => isNum(v) && v >= 0 && v <= 100)) {
        throw new Error('Metas inválidas: informe fiis, acoes e renda_fixa como números entre 0 e 100.')
      }
      const alvos: AllocationTargets = { fiis: op.fiis as number, acoes: op.acoes as number, renda_fixa: op.renda_fixa as number }
      const sum = alvos.fiis + alvos.acoes + alvos.renda_fixa
      if (Math.abs(sum - 100) > 0.1) throw new Error(`As metas precisam somar 100% (soma atual: ${num(sum)}).`)
      const labels: [keyof AllocationTargets, string][] = [['fiis', 'Meta FIIs'], ['acoes', 'Meta Ações'], ['renda_fixa', 'Meta Renda Fixa']]
      return {
        snapshot: { ...s, settings: { ...s.settings, alvos } },
        rows: labels.map(([key, label]) => ({
          label, before: `${num(s.settings.alvos[key])}%`, after: `${num(alvos[key])}%`, mode: 'alterar' as const,
        })),
      }
    }
    case 'set_strategy_text': {
      if (typeof op.text !== 'string' || op.text.length > 5000) throw new Error('Texto da estratégia inválido.')
      const cut = (t: string) => (t.length > 60 ? `${t.slice(0, 60)}…` : t || '—')
      return {
        snapshot: { ...s, settings: { ...s.settings, estrategia: op.text } },
        rows: [{ label: 'Estratégia', before: cut(s.settings.estrategia), after: cut(op.text), mode: 'alterar' }],
      }
    }
    case 'set_contribution': {
      if (!isNum(op.amount) || op.amount < 0) throw new Error('Valor do aporte inválido.')
      return {
        snapshot: { ...s, contributionAmount: op.amount },
        rows: [{ label: 'Aporte', before: brl(s.contributionAmount), after: brl(op.amount), mode: 'alterar' }],
      }
    }
    case 'add_monthly_item': {
      const kind = kindOf(op.kind)
      const name = str(op.name)
      if (!name) throw new Error('Nome do item vazio.')
      const value = itemValue(op.value, name)
      if (s.monthlyPlan[kind.key].some((item) => sameName(item.name, name))) {
        throw new Error(`Já existe uma ${kind.noun} chamada "${name}"; use update_monthly_item para alterá-la.`)
      }
      const category = canonicalCategory(s.monthlyPlan, str(op.category) || 'Outros')
      const item: MonthlyItem = { id: createId(), name, value, category }
      return {
        snapshot: {
          ...s,
          monthlyPlan: {
            ...s.monthlyPlan,
            [kind.key]: [...s.monthlyPlan[kind.key], item],
            categories: withCategory(s.monthlyPlan, category),
          },
        },
        rows: [{ label: `${kind.label} ${name}`, after: itemSummary(item), mode: 'criar' }],
      }
    }
    case 'update_monthly_item': {
      const { kind, item } = locateItem(s, op)
      const rows: SettingsPreviewRow[] = []
      let next = { ...item }
      if (op.newName !== undefined) {
        const newName = str(op.newName)
        if (!newName) throw new Error('Nome do item vazio.')
        if (s.monthlyPlan[kind.key].some((o) => o.id !== item.id && sameName(o.name, newName))) {
          throw new Error(`Já existe uma ${kind.noun} chamada "${newName}"; use update_monthly_item para alterá-la.`)
        }
        if (newName !== item.name) {
          rows.push({ label: `${kind.label} ${item.name}`, before: item.name, after: newName, mode: 'alterar' })
          next = { ...next, name: newName }
        }
      }
      if (op.value !== undefined) {
        const value = itemValue(op.value, item.name)
        if (value !== item.value) {
          rows.push({ label: `${kind.label} ${item.name}`, before: brl(item.value), after: brl(value), mode: 'alterar' })
          next = { ...next, value }
        }
      }
      let categories = s.monthlyPlan.categories
      if (op.category !== undefined) {
        const category = canonicalCategory(s.monthlyPlan, str(op.category) || 'Outros')
        if (category !== item.category) {
          rows.push({ label: `${kind.label} ${item.name}`, before: item.category, after: category, mode: 'alterar' })
          next = { ...next, category }
          categories = withCategory(s.monthlyPlan, category)
        }
      }
      if (rows.length === 0) throw new Error(`Nada a alterar em ${item.name}.`)
      return {
        snapshot: {
          ...s,
          monthlyPlan: {
            ...s.monthlyPlan,
            [kind.key]: s.monthlyPlan[kind.key].map((o) => (o.id === item.id ? next : o)),
            categories,
          },
        },
        rows,
      }
    }
    case 'remove_monthly_item': {
      const { kind, item } = locateItem(s, op)
      return {
        snapshot: {
          ...s,
          monthlyPlan: { ...s.monthlyPlan, [kind.key]: s.monthlyPlan[kind.key].filter((o) => o.id !== item.id) },
        },
        rows: [{ label: `${kind.label} ${item.name}`, before: itemSummary(item), mode: 'remover' }],
      }
    }
    case 'add_monthly_category': {
      const name = str(op.name)
      if (!name) throw new Error('Nome de categoria vazio.')
      if (s.monthlyPlan.categories.some((c) => sameName(c, name))) {
        throw new Error(`A categoria "${name}" já existe no plano mensal.`)
      }
      return {
        snapshot: { ...s, monthlyPlan: { ...s.monthlyPlan, categories: [...s.monthlyPlan.categories, name] } },
        rows: [{ label: `Categoria ${name}`, after: 'nova', mode: 'criar' }],
      }
    }
    case 'update_financing': {
      const { next, rows } = patchFields(s.financing.params, op.params, FINANCING_RULES, 'financiamento')
      if (next.downPayment >= next.propertyValue) throw new Error('A entrada precisa ser menor que o valor do imóvel.')
      return { snapshot: { ...s, financing: { ...s.financing, params: next, selectedPresetId: null } }, rows }
    }
    case 'apply_financing_preset': {
      const preset = FINANCING_PRESETS.find((p) => p.id === op.presetId)
      if (!preset) {
        throw new Error(
          `Preset desconhecido: "${String(op.presetId)}". Use um de: ${FINANCING_PRESETS.map((p) => p.id).join(', ')}.`,
        )
      }
      return {
        snapshot: {
          ...s,
          financing: {
            params: { ...s.financing.params, ...preset.params },
            extraConfig: preset.extraConfig ? { ...s.financing.extraConfig, ...preset.extraConfig } : s.financing.extraConfig,
            selectedPresetId: preset.id,
          },
        },
        rows: [{ label: 'Preset de financiamento', after: preset.name, mode: 'alterar' }],
      }
    }
    case 'update_extra_amortization': {
      const { next, rows } = patchFields(s.financing.extraConfig, op.config, EXTRA_RULES, 'amortização extra')
      if (next.periodStartMonth > next.periodEndMonth) throw new Error('O mês inicial precisa ser menor ou igual ao mês final.')
      return { snapshot: { ...s, financing: { ...s.financing, extraConfig: next } }, rows }
    }
    case 'add_lump_sum': {
      if (!isNum(op.month) || !Number.isInteger(op.month) || op.month < 1 || op.month > 480) {
        throw new Error('Mês inválido para o aporte avulso.')
      }
      if (!isNum(op.amount) || op.amount <= 0) throw new Error('Valor inválido para o aporte avulso.')
      const recalculation = (op.recalculation ?? 'prazo') as AmortizationRecalculation
      if (recalculation !== 'prazo' && recalculation !== 'parcela') throw new Error('recalculation: use "prazo" ou "parcela".')
      const description = str(op.description) || 'Aporte avulso'
      const lumpSum = { id: createId(), month: op.month, amount: op.amount, recalculation, description }
      return {
        snapshot: {
          ...s,
          financing: {
            ...s.financing,
            extraConfig: { ...s.financing.extraConfig, lumpSums: [...s.financing.extraConfig.lumpSums, lumpSum] },
          },
        },
        rows: [{ label: `Aporte avulso mês ${op.month}`, after: `${brl(op.amount)} · ${recalculation}`, mode: 'criar' }],
      }
    }
    case 'remove_lump_sum': {
      const removed = s.financing.extraConfig.lumpSums.filter((l) => l.month === op.month)
      if (removed.length === 0) throw new Error(`Não há aporte avulso no mês ${String(op.month)}.`)
      return {
        snapshot: {
          ...s,
          financing: {
            ...s.financing,
            extraConfig: {
              ...s.financing.extraConfig,
              lumpSums: s.financing.extraConfig.lumpSums.filter((l) => l.month !== op.month),
            },
          },
        },
        rows: removed.map((l) => ({
          label: `Aporte avulso mês ${l.month}`, before: `${brl(l.amount)} · ${l.recalculation}`, mode: 'remover' as const,
        })),
      }
    }
    case 'set_projection': {
      const patch: Record<string, unknown> = {}
      for (const key of Object.keys(PROJECTION_RULES)) if (key in op) patch[key] = op[key]
      const { next, rows } = patchFields(s.projection, patch, PROJECTION_RULES, 'projeção')
      return { snapshot: { ...s, projection: next }, rows }
    }
    default:
      throw new Error('Tipo de operação desconhecido.')
  }
}

export function runSettingsOperations(
  snapshot: SettingsSnapshot,
  operations: SettingsOperation[],
  createId: () => string = () => crypto.randomUUID(),
): SettingsRunResult {
  let current = snapshot
  const errors: string[] = []
  const rows: SettingsPreviewRow[] = []
  operations.forEach((op, index) => {
    try {
      const result = applyOne(current, op, createId)
      current = result.snapshot
      rows.push(...result.rows)
    } catch (error) {
      errors.push(`Operação ${index + 1} (${String(op?.type)}): ${(error as Error).message}`)
    }
  })
  return { snapshot: current, errors, rows }
}
