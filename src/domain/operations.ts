import type { Portfolio, PortfolioData } from '../store/useInvestmentStore'
import {
  SECTIONS,
  categoryOfRecord,
  isBuiltinCategory,
  normalizeTicker,
  rawName,
  recordTicker,
  sectionForCategory,
  unitPrice,
  type SectionKey,
} from './assets'

export type AssetOperation =
  | { type: 'upsert_asset'; ticker: string; category: string; quantity: number; avgPrice: number; mode: 'add' | 'set' }
  | { type: 'remove_asset'; ticker: string }
  | { type: 'move_asset'; ticker: string; category: string }
  | { type: 'add_category'; name: string }
  | { type: 'rename_category'; from: string; to: string }
  | { type: 'remove_category'; name: string; moveTo?: string }

export interface Workspace {
  portfolios: Portfolio[]
  categories: string[]
}

export interface RunResult {
  workspace: Workspace
  errors: string[]
}

export type PreviewMode =
  | 'novo'
  | 'somar'
  | 'substituir'
  | 'remover'
  | 'mover'
  | 'nova categoria'
  | 'renomear'
  | 'excluir categoria'

export interface PreviewRow {
  label: string
  category: string
  quantity?: number
  avgPrice?: number
  mode: PreviewMode
}

interface Located {
  section: SectionKey
  index: number
  record: any
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

const findCategory = (categories: string[], name: string | undefined): string | undefined =>
  name ? categories.find((c) => sameName(c, name)) : undefined

const sectionList = (data: PortfolioData, section: SectionKey): any[] => ((data as any)[section] || []) as any[]

function locate(data: PortfolioData, ticker: string): Located | null {
  const wanted = normalizeTicker(ticker)
  for (const section of SECTIONS) {
    const index = sectionList(data, section).findIndex((r) => recordTicker(r) === wanted)
    if (index >= 0) return { section, index, record: sectionList(data, section)[index] }
  }
  return null
}

function withTotals(data: PortfolioData): PortfolioData {
  const all = SECTIONS.flatMap((section) => sectionList(data, section))
  return {
    ...data,
    total_live: all.reduce((acc, r) => acc + (Number(r.Posicao) || 0), 0),
    resumo: {
      saldo_disponivel: data.resumo?.saldo_disponivel || 0,
      saldo_projetado: data.resumo?.saldo_projetado || 0,
      total_investido: all.reduce((acc, r) => acc + (Number(r.PrecoMedio) || 0) * (Number(r.Quantidade) || 0), 0),
    },
  }
}

const displayName = (section: SectionKey, ticker: string, previous?: any): string =>
  section === 'acoes' || section === 'fiis' ? normalizeTicker(ticker) : previous ? rawName(previous) : ticker.trim()

function buildRecord(
  section: SectionKey,
  name: string,
  category: string,
  quantity: number,
  avgPrice: number,
  price: number,
  previous: any,
  keepSegment: boolean,
): any {
  const rest: any = { ...(previous || {}) }
  for (const field of ['Ticker', 'Titulo', 'Ativo', 'Categoria', 'portfolioId', 'portfolioName', 'portfolioColor']) {
    delete rest[field]
  }
  const base = { ...rest, Quantidade: quantity, PrecoMedio: avgPrice, Cotacao: price, Posicao: quantity * price }
  const segment = keepSegment && rest.Segmento ? rest.Segmento : category
  if (section === 'tesouro') return { ...base, Titulo: name, Vencimento: rest.Vencimento ?? '-' }
  if (section === 'renda_fixa') return { ...base, Ativo: name, Indexador: rest.Indexador ?? '-' }
  if (section === 'manualAssets') {
    return { ...base, id: rest.id ?? crypto.randomUUID(), Ticker: name, Categoria: category, Segmento: segment }
  }
  return { ...base, Ticker: name, Segmento: segment }
}

function put(data: PortfolioData, found: Located | null, section: SectionKey, record: any): PortfolioData {
  const next: any = { ...data }
  if (found && found.section === section) {
    next[section] = sectionList(data, section).map((r, i) => (i === found.index ? record : r))
  } else {
    if (found) next[found.section] = sectionList(data, found.section).filter((_, i) => i !== found.index)
    next[section] = [...sectionList(next, section), record]
  }
  return withTotals(next)
}

function moveRecord(data: PortfolioData, found: Located, category: string): PortfolioData {
  const section = sectionForCategory(category)
  const record = buildRecord(
    section,
    displayName(section, rawName(found.record), found.record),
    category,
    Number(found.record.Quantidade) || 0,
    Number(found.record.PrecoMedio) || 0,
    unitPrice(found.record),
    found.record,
    false,
  )
  return put(data, found, section, record)
}

function applyAssetOperation(
  data: PortfolioData,
  categories: string[],
  op: Extract<AssetOperation, { ticker: string }>,
): PortfolioData {
  const ticker = (op.ticker || '').trim()
  if (!ticker) throw new Error('Ticker vazio.')
  const found = locate(data, ticker)

  if (op.type === 'remove_asset') {
    if (!found) throw new Error(`O ativo ${ticker} não existe na carteira.`)
    return withTotals({
      ...data,
      [found.section]: sectionList(data, found.section).filter((_, i) => i !== found.index),
    } as PortfolioData)
  }

  const category = findCategory(categories, op.category)
  if (!category) throw new Error(`A categoria "${op.category}" não existe. Crie-a com add_category antes de usá-la.`)

  if (op.type === 'move_asset') {
    if (!found) throw new Error(`O ativo ${ticker} não existe na carteira.`)
    return moveRecord(data, found, category)
  }

  if (!Number.isFinite(op.quantity) || op.quantity <= 0) throw new Error(`Quantidade inválida para ${ticker}.`)
  if (!Number.isFinite(op.avgPrice) || op.avgPrice < 0) throw new Error(`Preço médio inválido para ${ticker}.`)

  const section = sectionForCategory(category)
  const previousQuantity = found ? Number(found.record.Quantidade) || 0 : 0
  const previousAvgPrice = found ? Number(found.record.PrecoMedio) || 0 : 0
  const adding = found !== null && op.mode === 'add'
  const quantity = adding ? previousQuantity + op.quantity : op.quantity
  const avgPrice = adding
    ? (previousQuantity * previousAvgPrice + op.quantity * op.avgPrice) / quantity
    : op.avgPrice
  const price = (found ? unitPrice(found.record) : 0) || avgPrice
  const record = buildRecord(
    section,
    displayName(section, ticker, found?.record),
    category,
    quantity,
    avgPrice,
    price,
    found?.record,
    found?.section === section,
  )
  return put(data, found, section, record)
}

function moveCategoryAssets(portfolio: Portfolio, from: string, to: string): Portfolio {
  let data = portfolio.data
  for (;;) {
    const index = sectionList(data, 'manualAssets').findIndex((r) => (r.Categoria || 'Outros') === from)
    if (index < 0) break
    data = moveRecord(data, { section: 'manualAssets', index, record: sectionList(data, 'manualAssets')[index] }, to)
  }
  return data === portfolio.data ? portfolio : { ...portfolio, data }
}

function applyOne(workspace: Workspace, targetPortfolioId: string, op: AssetOperation): Workspace {
  switch (op.type) {
    case 'upsert_asset':
    case 'remove_asset':
    case 'move_asset': {
      const target = workspace.portfolios.find((p) => p.id === targetPortfolioId)
      if (!target) throw new Error('Carteira de destino não encontrada.')
      const data = applyAssetOperation(target.data, workspace.categories, op)
      return { ...workspace, portfolios: workspace.portfolios.map((p) => (p.id === targetPortfolioId ? { ...p, data } : p)) }
    }
    case 'add_category': {
      const name = (op.name || '').trim()
      if (!name) throw new Error('Nome de categoria vazio.')
      if (findCategory(workspace.categories, name)) throw new Error(`A categoria "${name}" já existe.`)
      return { ...workspace, categories: [...workspace.categories, name] }
    }
    case 'rename_category': {
      const from = findCategory(workspace.categories, op.from)
      const to = (op.to || '').trim()
      if (!from) throw new Error(`A categoria "${op.from}" não existe.`)
      if (isBuiltinCategory(from)) throw new Error(`A categoria "${from}" é embutida e não pode ser renomeada.`)
      if (!to) throw new Error('Novo nome de categoria vazio.')
      if (findCategory(workspace.categories, to)) throw new Error(`A categoria "${to}" já existe.`)
      return {
        categories: workspace.categories.map((c) => (c === from ? to : c)),
        portfolios: workspace.portfolios.map((p) => moveCategoryAssets(p, from, to)),
      }
    }
    case 'remove_category': {
      const name = findCategory(workspace.categories, op.name)
      if (!name) throw new Error(`A categoria "${op.name}" não existe.`)
      if (isBuiltinCategory(name)) throw new Error(`A categoria "${name}" é embutida e não pode ser excluída.`)
      const inUse = workspace.portfolios.some((p) =>
        sectionList(p.data, 'manualAssets').some((r) => (r.Categoria || 'Outros') === name),
      )
      let portfolios = workspace.portfolios
      if (inUse) {
        const moveTo = findCategory(workspace.categories, op.moveTo)
        if (!moveTo || moveTo === name) {
          throw new Error(`A categoria "${name}" ainda tem ativos; informe moveTo com outra categoria existente.`)
        }
        portfolios = workspace.portfolios.map((p) => moveCategoryAssets(p, name, moveTo))
      }
      return { categories: workspace.categories.filter((c) => c !== name), portfolios }
    }
    default:
      throw new Error('Tipo de operação desconhecido.')
  }
}

export function runOperations(
  workspace: Workspace,
  targetPortfolioId: string,
  operations: AssetOperation[],
): RunResult {
  let current = workspace
  const errors: string[] = []
  operations.forEach((op, index) => {
    try {
      current = applyOne(current, targetPortfolioId, op)
    } catch (error) {
      errors.push(`Operação ${index + 1} (${op.type}): ${(error as Error).message}`)
    }
  })
  return { workspace: current, errors }
}

export function describeOperations(
  workspace: Workspace,
  targetPortfolioId: string,
  operations: AssetOperation[],
): PreviewRow[] {
  let current = workspace
  const rows: PreviewRow[] = []
  for (const op of operations) {
    const target = current.portfolios.find((p) => p.id === targetPortfolioId)
    const found = target && 'ticker' in op ? locate(target.data, op.ticker) : null
    const assetLabel = (ticker: string) => (found ? recordTicker(found.record) : normalizeTicker(ticker))
    switch (op.type) {
      case 'upsert_asset': {
        const section = sectionForCategory(findCategory(current.categories, op.category) ?? op.category)
        rows.push({
          label: found ? displayName(found.section, rawName(found.record), found.record) : displayName(section, op.ticker),
          category: findCategory(current.categories, op.category) ?? op.category,
          quantity: op.quantity,
          avgPrice: op.avgPrice,
          mode: found ? (op.mode === 'add' ? 'somar' : 'substituir') : 'novo',
        })
        break
      }
      case 'remove_asset':
        rows.push({
          label: found ? displayName(found.section, rawName(found.record), found.record) : assetLabel(op.ticker),
          category: found ? categoryOfRecord(found.record, found.section) : '—',
          ...(found ? { quantity: Number(found.record.Quantidade) || 0 } : {}),
          mode: 'remover',
        })
        break
      case 'move_asset':
        rows.push({
          label: found ? displayName(found.section, rawName(found.record), found.record) : assetLabel(op.ticker),
          category: findCategory(current.categories, op.category) ?? op.category,
          mode: 'mover',
        })
        break
      case 'add_category':
        rows.push({ label: op.name.trim(), category: op.name.trim(), mode: 'nova categoria' })
        break
      case 'rename_category':
        rows.push({ label: `${op.from} → ${op.to}`, category: op.to, mode: 'renomear' })
        break
      case 'remove_category':
        rows.push({ label: op.name, category: op.moveTo ?? '—', mode: 'excluir categoria' })
        break
    }
    current = runOperations(current, targetPortfolioId, [op]).workspace
  }
  return rows
}
