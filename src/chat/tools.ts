import { isBuiltinCategory, listAssets } from '../domain/assets'
import {
  describeOperations,
  runOperations,
  type AssetOperation,
  type PreviewRow,
  type Workspace,
} from '../domain/operations'
import type { ToolDefinition } from '../lib/openrouter/client'
import type { PortfolioData } from '../store/useInvestmentStore'

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
}

export interface ToolContext {
  workspace: Workspace
  viewData: PortfolioData | null
  viewLabel: string
  targetPortfolioId: string
  allocationTargets: Record<string, number>
  createId: () => string
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
]

const round2 = (value: number): number => Math.round(value * 100) / 100

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const failure = (errors: string[]): ToolResult => ({ content: JSON.stringify({ ok: false, errors }) })

function parseOperation(raw: any, index: number): AssetOperation | string {
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
}

function proposeChanges(args: any, context: ToolContext): ToolResult {
  const rawOperations: unknown[] = Array.isArray(args?.operations) ? args.operations : []
  if (rawOperations.length === 0) return failure(['Informe ao menos uma operação em "operations".'])

  const parsed = rawOperations.map(parseOperation)
  const parseErrors = parsed.filter((item): item is string => typeof item === 'string')
  if (parseErrors.length > 0) return failure(parseErrors)
  const operations = parsed as AssetOperation[]

  const { errors } = runOperations(context.workspace, context.targetPortfolioId, operations)
  if (errors.length > 0) return failure(errors)

  const target = context.workspace.portfolios.find((p) => p.id === context.targetPortfolioId)
  const proposal: Proposal = {
    id: context.createId(),
    portfolioId: context.targetPortfolioId,
    portfolioName: target?.name ?? '',
    summary: text(args?.summary),
    operations,
    rows: describeOperations(context.workspace, context.targetPortfolioId, operations),
    status: 'pending',
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
}

export function executeTool(name: string, rawArguments: string, context: ToolContext): ToolResult {
  let args: unknown
  try {
    args = rawArguments.trim() === '' ? {} : JSON.parse(rawArguments)
  } catch {
    return failure(['Argumentos inválidos: não é um JSON válido.'])
  }
  if (name === 'get_portfolio') return getPortfolio(context)
  if (name === 'propose_changes') return proposeChanges(args, context)
  return failure([`Ferramenta desconhecida: ${name}.`])
}
