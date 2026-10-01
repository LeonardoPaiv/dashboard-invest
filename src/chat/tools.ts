import { isBuiltinCategory, listAssets } from '../domain/assets'
import {
  describeOperations,
  runOperations,
  type AssetOperation,
  type PreviewRow,
  type Workspace,
} from '../domain/operations'
import { PAGES, isPageId, pageLabel, type PageId } from '../domain/pages'
import {
  SETTINGS_OPERATION_TYPES,
  pageOfOperations,
  runSettingsOperations,
  type SettingsOperation,
  type SettingsPreviewRow,
  type SettingsSnapshot,
} from '../domain/settingsOperations'
import type { ToolDefinition } from '../lib/openrouter/client'
import { FINANCING_PRESETS } from '../store/useFinancingStore'
import type { PortfolioData } from '../store/useInvestmentStore'
import { simulateFinancing } from '../utils/financingEngine'

export type ProposalStatus = 'pending' | 'done' | 'dismissed' | 'failed'

export interface Proposal {
  id: string
  portfolioId: string
  portfolioName: string
  summary: string
  operations: AssetOperation[]
  rows: PreviewRow[]
  status: ProposalStatus
  error?: string
  page?: PageId
  settings?: { operations: SettingsOperation[]; rows: SettingsPreviewRow[] }
}

export interface ToolContext {
  workspace: Workspace
  viewData: PortfolioData | null
  viewLabel: string
  targetPortfolioId: string
  allocationTargets: Record<string, number>
  createId: () => string
  currentPage: PageId
  navigate: (page: PageId) => void
  selectPortfolio: (portfolioId: string) => void
  app: SettingsSnapshot
  monthlyHistory: { date: string; totalIncome: number; totalExpense: number; savings: number }[]
}

export interface ToolResult {
  content: string
  proposal?: Proposal
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_portfolio',
      description:
        'Lê a carteira que o usuário está vendo: total, categorias com valor e percentual, lista de ativos (ticker, categoria, quantidade, preço médio, cotação, valor) e metas de alocação. Somente leitura.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_changes',
      description:
        'Mostra ao usuário uma prévia de alterações em ativos e categorias. Nada é salvo até o usuário confirmar na interface. Se devolver erros, corrija e chame de novo.',
      parameters: {
        type: 'object',
        properties: {
          portfolio: { type: 'string', description: 'Opcional: nome da carteira de destino. Padrão: a carteira que o usuário está vendo.' },
          summary: {
            type: 'string',
            description:
              'Uma ou duas frases para o usuário: de onde vieram os dados, como as colunas foram interpretadas e qualquer suposição feita.',
          },
          operations: {
            type: 'array',
            description: 'Operações aplicadas em ordem.',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['upsert_asset', 'remove_asset', 'move_asset', 'add_category', 'rename_category', 'remove_category'],
                },
                ticker: { type: 'string', description: 'upsert_asset, remove_asset, move_asset: código ou nome do ativo.' },
                category: { type: 'string', description: 'upsert_asset, move_asset: categoria de destino (precisa existir).' },
                quantity: { type: 'number', description: 'upsert_asset: quantidade, maior que zero.' },
                avgPrice: { type: 'number', description: 'upsert_asset: preço médio unitário em reais.' },
                mode: {
                  type: 'string',
                  enum: ['add', 'set'],
                  description: 'upsert_asset: "add" soma à posição existente (padrão); "set" substitui.',
                },
                name: { type: 'string', description: 'add_category, remove_category: nome da categoria.' },
                from: { type: 'string', description: 'rename_category: nome atual.' },
                to: { type: 'string', description: 'rename_category: novo nome.' },
                moveTo: {
                  type: 'string',
                  description: 'remove_category: categoria que recebe os ativos, obrigatória se a categoria não estiver vazia.',
                },
              },
              required: ['type'],
            },
          },
        },
        required: ['summary', 'operations'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description:
        'Leva o usuário para outra página do app e, se informado, troca a carteira exibida. Use quando o assunto ou a alteração pertence a outra página. Efeito imediato, sem confirmação.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            enum: PAGES.map((page) => page.id),
            description: PAGES.map((page) => `${page.id}: ${page.about}`).join('; '),
          },
          portfolio: {
            type: 'string',
            description: 'Opcional: nome da carteira a exibir, ou "todas" para a visão consolidada.',
          },
        },
        required: ['page'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_app_data',
      description:
        'Lê os dados locais do app fora da lista de ativos: carteiras, estratégia (metas, aporte), plano mensal, histórico de fechamentos, financiamento (parâmetros, amortização extra, resumo calculado) e projeção. Somente leitura.',
      parameters: {
        type: 'object',
        properties: {
          sections: {
            type: 'array',
            items: { type: 'string', enum: ['carteiras', 'estrategia', 'plano_mensal', 'historico', 'financiamento', 'projecao'] },
            description: 'Seções desejadas. Omita para receber todas.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_settings',
      description:
        'Mostra ao usuário uma prévia de alterações de configuração (carteiras, metas, aporte, plano mensal, financiamento, projeção). Nada é salvo até o usuário confirmar. Se devolver erros, corrija e chame de novo.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Uma ou duas frases explicando a alteração e qualquer suposição feita.' },
          operations: {
            type: 'array',
            description: 'Operações aplicadas em ordem.',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: [...SETTINGS_OPERATION_TYPES] },
                name: { type: 'string', description: 'create_portfolio, rename_portfolio: novo nome. *_monthly_item: nome do item. add_monthly_category: nome.' },
                portfolio: { type: 'string', description: 'rename_portfolio, delete_portfolio: nome atual da carteira.' },
                fiis: { type: 'number', description: 'set_allocation_targets: meta em %.' },
                acoes: { type: 'number', description: 'set_allocation_targets: meta em %.' },
                renda_fixa: { type: 'number', description: 'set_allocation_targets: meta em %. As três somam 100.' },
                text: { type: 'string', description: 'set_strategy_text: texto da estratégia.' },
                amount: { type: 'number', description: 'set_contribution: aporte em reais. add_lump_sum: valor do aporte avulso.' },
                kind: { type: 'string', enum: ['income', 'expense'], description: '*_monthly_item: receita (income) ou despesa (expense).' },
                value: { type: 'number', description: 'add_monthly_item, update_monthly_item: valor mensal em reais.' },
                category: { type: 'string', description: 'add_monthly_item, update_monthly_item: categoria do orçamento.' },
                newName: { type: 'string', description: 'update_monthly_item: novo nome do item.' },
                params: {
                  type: 'object',
                  description:
                    'update_financing: só os campos a mudar. Números: propertyValue, appraisalValue, downPayment, termMonths, annualInterestRateNominal, monthlyIndexerRate, itbiPercent, registryFeePercent, appraisalFeeFixed, borrowerAge, dfiMonthlyRate, tcaMonthlyFixed, customMipRate, monthlyGrossIncome. Booleanos: useCustomAppraisal, financeInitialExpenses, applySFHDiscount, useCustomMipRate. amortizationType: SAC|PRICE. indexerType: TR|IPCA|POUPANCA|PREFIXADO.',
                },
                presetId: { type: 'string', description: 'apply_financing_preset: id de um preset listado por get_app_data.' },
                config: {
                  type: 'object',
                  description:
                    'update_extra_amortization: só os campos a mudar. enabled (booleano), mode: constant|target_installment|time_period|lump_sum, recalculation: prazo|parcela, monthlyAmount, targetInstallment, periodStartMonth, periodEndMonth.',
                },
                month: { type: 'number', description: 'add_lump_sum, remove_lump_sum: mês da parcela (1 = primeira).' },
                recalculation: { type: 'string', enum: ['prazo', 'parcela'], description: 'add_lump_sum: reduzir prazo (padrão) ou parcela.' },
                description: { type: 'string', description: 'add_lump_sum: rótulo do aporte.' },
                monthlyContribution: { type: 'number', description: 'set_projection: aporte mensal.' },
                annualRate: { type: 'number', description: 'set_projection: taxa anual em %.' },
                years: { type: 'number', description: 'set_projection: horizonte em anos.' },
              },
              required: ['type'],
            },
          },
        },
        required: ['summary', 'operations'],
      },
    },
  },
]

const round2 = (value: number): number => Math.round(value * 100) / 100

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const failure = (errors: string[]): ToolResult => ({ content: JSON.stringify({ ok: false, errors }) })

function parseOperation(raw: any, index: number): AssetOperation | string {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return `Operação ${index + 1}: tipo desconhecido "${String(raw)}".`
  }
  switch (raw?.type) {
    case 'upsert_asset':
      return {
        type: 'upsert_asset',
        ticker: text(raw.ticker),
        category: text(raw.category),
        quantity: typeof raw.quantity === 'number' ? raw.quantity : NaN,
        avgPrice: typeof raw.avgPrice === 'number' ? raw.avgPrice : NaN,
        mode: raw.mode === 'set' ? 'set' : 'add',
      }
    case 'remove_asset':
      return { type: 'remove_asset', ticker: text(raw.ticker) }
    case 'move_asset':
      return { type: 'move_asset', ticker: text(raw.ticker), category: text(raw.category) }
    case 'add_category':
      return { type: 'add_category', name: text(raw.name) }
    case 'rename_category':
      return { type: 'rename_category', from: text(raw.from), to: text(raw.to) }
    case 'remove_category':
      return { type: 'remove_category', name: text(raw.name), ...(text(raw.moveTo) ? { moveTo: text(raw.moveTo) } : {}) }
    default:
      return `Operação ${index + 1}: tipo desconhecido "${String(raw?.type)}".`
  }
}

function getPortfolio(context: ToolContext): ToolResult {
  try {
    const assets = listAssets(context.viewData)
    const total = assets.reduce((acc, a) => acc + a.value, 0)
    const byCategory = new Map<string, number>()
    for (const asset of assets) byCategory.set(asset.category, (byCategory.get(asset.category) || 0) + asset.value)
    const target = context.workspace.portfolios.find((p) => p.id === context.targetPortfolioId)
    return {
      content: JSON.stringify({
        portfolio: context.viewLabel,
        changesWillBeSavedTo: target?.name ?? null,
        total: round2(total),
        categories: context.workspace.categories.map((name) => {
          const value = byCategory.get(name) || 0
          return { name, builtin: isBuiltinCategory(name), value: round2(value), sharePct: total > 0 ? round2((value / total) * 100) : 0 }
        }),
        assets: assets.map((a) => ({
          ticker: a.ticker,
          category: a.category,
          quantity: a.quantity,
          avgPrice: round2(a.avgPrice),
          price: round2(a.price),
          value: round2(a.value),
        })),
        allocationTargetsPct: context.allocationTargets,
      }),
    }
  } catch {
    return failure(['Erro interno ao executar a ferramenta.'])
  }
}

function proposeChanges(args: any, context: ToolContext): ToolResult {
  try {
    const rawOperations: unknown[] = Array.isArray(args?.operations) ? args.operations : []
    if (rawOperations.length === 0) return failure(['Informe ao menos uma operação em "operations".'])

    const parsed = rawOperations.map(parseOperation)
    const parseErrors = parsed.filter((item): item is string => typeof item === 'string')
    if (parseErrors.length > 0) return failure(parseErrors)
    const operations = parsed as AssetOperation[]

    const wanted = text(args?.portfolio)
    const named = wanted ? context.workspace.portfolios.find((p) => p.name.trim().toLowerCase() === wanted.toLowerCase()) : undefined
    if (wanted && !named) return failure([`Carteira "${wanted}" não encontrada.`])
    const targetId = named?.id ?? context.targetPortfolioId

    const { errors } = runOperations(context.workspace, targetId, operations)
    if (errors.length > 0) return failure(errors)

    const target = context.workspace.portfolios.find((p) => p.id === targetId)
    const proposal: Proposal = {
      id: context.createId(),
      portfolioId: targetId,
      portfolioName: target?.name ?? '',
      summary: text(args?.summary),
      operations,
      rows: describeOperations(context.workspace, targetId, operations),
      status: 'pending',
      page: 'dashboard',
    }
    return {
      proposal,
      content: JSON.stringify({
        ok: true,
        proposalId: proposal.id,
        status: 'pending_user_confirmation',
        message: `Prévia exibida ao usuário. Nada foi salvo; ele precisa clicar em Confirmar. Destino: ${proposal.portfolioName}.`,
      }),
    }
  } catch {
    return failure(['Erro interno ao executar a ferramenta.'])
  }
}

const SECTIONS_ALL = ['carteiras', 'estrategia', 'plano_mensal', 'historico', 'financiamento', 'projecao'] as const

function getAppData(args: any, context: ToolContext): ToolResult {
  try {
    const requested: unknown[] = Array.isArray(args?.sections) && args.sections.length > 0 ? args.sections : [...SECTIONS_ALL]
    const unknown = requested.filter((s) => !SECTIONS_ALL.includes(s as (typeof SECTIONS_ALL)[number]))
    if (unknown.length > 0) return failure([`Seção desconhecida: ${unknown.map(String).join(', ')}. Use: ${SECTIONS_ALL.join(', ')}.`])
    const { app } = context
    const out: Record<string, unknown> = { currentPage: context.currentPage }
    const sum = (items: { value: number }[]) => items.reduce((acc, item) => acc + (Number(item.value) || 0), 0)
    for (const section of requested as (typeof SECTIONS_ALL)[number][]) {
      if (section === 'carteiras') {
        out.carteiras = app.portfolios.map((p) => ({
          name: p.name,
          active: p.id === app.activePortfolioId,
          assets: listAssets(p.data).length,
          total: round2(listAssets(p.data).reduce((acc, a) => acc + a.value, 0)),
        }))
      } else if (section === 'estrategia') {
        out.estrategia = { text: app.settings.estrategia, targetsPct: app.settings.alvos, contributionAmount: app.contributionAmount }
      } else if (section === 'plano_mensal') {
        const item = ({ name, value, category }: { name: string; value: number; category: string }) => ({ name, value, category })
        const totalIncome = round2(sum(app.monthlyPlan.incomes))
        const totalExpense = round2(sum(app.monthlyPlan.expenses))
        out.plano_mensal = {
          incomes: app.monthlyPlan.incomes.map(item),
          expenses: app.monthlyPlan.expenses.map(item),
          categories: app.monthlyPlan.categories,
          totalIncome,
          totalExpense,
          balance: round2(totalIncome - totalExpense),
        }
      } else if (section === 'historico') {
        out.historico = context.monthlyHistory
      } else if (section === 'financiamento') {
        const { params, extraConfig, selectedPresetId } = app.financing
        const { summary } = simulateFinancing(params, extraConfig)
        out.financiamento = {
          params,
          extraConfig,
          selectedPresetId,
          presets: FINANCING_PRESETS.map((p) => ({ id: p.id, name: p.name, description: p.description })),
          summary: {
            financedAmount: round2(summary.financedAmount),
            firstInstallment: round2(summary.firstInstallment),
            lastInstallment: round2(summary.lastInstallment),
            totalPaid: round2(summary.totalPaid),
            totalInterest: round2(summary.totalInterest),
            actualMonthsToPayoff: summary.actualMonthsToPayoff,
            monthsSaved: summary.monthsSaved,
            cetAnnualEstimated: round2(summary.cetAnnualEstimated),
            incomeCommitmentPercent: round2(summary.incomeCommitmentPercent),
          },
        }
      } else {
        const { monthlyContribution, annualRate, years } = app.projection
        const initialCapital = listAssets(context.viewData).reduce((acc, a) => acc + a.value, 0)
        const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1
        let total = initialCapital
        for (let month = 0; month < years * 12; month++) total = total * (1 + monthlyRate) + monthlyContribution
        out.projecao = { monthlyContribution, annualRate, years, initialCapital: round2(initialCapital), estimatedFinalValue: round2(total) }
      }
    }
    return { content: JSON.stringify(out) }
  } catch {
    return failure(['Erro interno ao executar a ferramenta.'])
  }
}

function proposeSettings(args: any, context: ToolContext): ToolResult {
  try {
    const raw: unknown[] = Array.isArray(args?.operations) ? args.operations : []
    if (raw.length === 0) return failure(['Informe ao menos uma operação em "operations".'])
    const known = (value: unknown): value is SettingsOperation =>
      value !== null && typeof value === 'object' && !Array.isArray(value) &&
      (SETTINGS_OPERATION_TYPES as readonly unknown[]).includes((value as { type?: unknown }).type)
    const shapeErrors = raw.flatMap((item, index) =>
      known(item) ? [] : [`Operação ${index + 1}: tipo desconhecido "${String((item as { type?: unknown } | null)?.type ?? item)}".`],
    )
    if (shapeErrors.length > 0) return failure(shapeErrors)
    const operations = raw as SettingsOperation[]

    const { errors, rows } = runSettingsOperations(context.app, operations)
    if (errors.length > 0) return failure(errors)

    const page = pageOfOperations(operations)
    const proposal: Proposal = {
      id: context.createId(),
      portfolioId: '',
      portfolioName: pageLabel(page),
      summary: text(args?.summary),
      operations: [],
      rows: [],
      status: 'pending',
      page,
      settings: { operations, rows },
    }
    return {
      proposal,
      content: JSON.stringify({
        ok: true,
        proposalId: proposal.id,
        status: 'pending_user_confirmation',
        message: `Prévia exibida ao usuário. Nada foi salvo; ele precisa clicar em Confirmar. O cartão tem um botão "Visualizar página" para abrir ${proposal.portfolioName}.`,
      }),
    }
  } catch {
    return failure(['Erro interno ao executar a ferramenta.'])
  }
}

function navigateTo(args: any, context: ToolContext): ToolResult {
  if (!isPageId(args?.page)) {
    return failure([`Página desconhecida: "${String(args?.page)}". Use uma de: ${PAGES.map((p) => p.id).join(', ')}.`])
  }
  const wanted = text(args?.portfolio)
  let portfolioId: string | undefined
  let portfolioName: string | undefined
  if (wanted) {
    if (['todas', 'all'].includes(wanted.toLowerCase())) {
      portfolioId = 'all'
      portfolioName = 'Todas as carteiras'
    } else {
      const found = context.workspace.portfolios.find((p) => p.name.trim().toLowerCase() === wanted.toLowerCase())
      if (!found) return failure([`Carteira "${wanted}" não encontrada.`])
      portfolioId = found.id
      portfolioName = found.name
    }
  }
  if (portfolioId) context.selectPortfolio(portfolioId)
  context.navigate(args.page)
  return {
    content: JSON.stringify({
      ok: true,
      page: args.page,
      label: pageLabel(args.page),
      ...(portfolioName ? { portfolio: portfolioName } : {}),
    }),
  }
}

export function executeTool(name: string, rawArguments: unknown, context: ToolContext): ToolResult {
  let args: unknown

  if (typeof rawArguments === 'string') {
    try {
      args = rawArguments.trim() === '' ? {} : JSON.parse(rawArguments)
    } catch {
      return failure(['Argumentos inválidos: não é um JSON válido.'])
    }
  } else if (rawArguments === null || rawArguments === undefined) {
    args = {}
  } else if (typeof rawArguments === 'object') {
    args = rawArguments
  } else {
    return failure(['Argumentos inválidos: não é um JSON válido.'])
  }

  if (name === 'get_portfolio') return getPortfolio(context)
  if (name === 'propose_changes') return proposeChanges(args, context)
  if (name === 'navigate') return navigateTo(args, context)
  if (name === 'get_app_data') return getAppData(args, context)
  if (name === 'propose_settings') return proposeSettings(args, context)
  return failure([`Ferramenta desconhecida: ${name}.`])
}
