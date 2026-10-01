import type { Portfolio, PortfolioData } from '../store/useInvestmentStore'

export type SectionKey = 'acoes' | 'fiis' | 'tesouro' | 'renda_fixa' | 'manualAssets'

export const SECTIONS: SectionKey[] = ['acoes', 'fiis', 'tesouro', 'renda_fixa', 'manualAssets']

export const BUILTIN_CATEGORIES = ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto'] as const

const CATEGORY_SECTION: Record<string, SectionKey> = {
  'Ações': 'acoes',
  'FIIs': 'fiis',
  'Renda Fixa': 'renda_fixa',
  'Tesouro Direto': 'tesouro',
}

const SECTION_CATEGORY: Record<Exclude<SectionKey, 'manualAssets'>, string> = {
  acoes: 'Ações',
  fiis: 'FIIs',
  renda_fixa: 'Renda Fixa',
  tesouro: 'Tesouro Direto',
}

export const isBuiltinCategory = (name: string): boolean => Object.prototype.hasOwnProperty.call(CATEGORY_SECTION, name)

export const sectionForCategory = (category: string): SectionKey => {
  const section = Object.prototype.hasOwnProperty.call(CATEGORY_SECTION, category) ? CATEGORY_SECTION[category] : undefined
  return section ?? 'manualAssets'
}

export const normalizeTicker = (ticker: string): string => ticker.trim().toUpperCase()

export const rawName = (record: any): string => String(record?.Ticker ?? record?.Titulo ?? record?.Ativo ?? '').trim()

export const recordTicker = (record: any): string => normalizeTicker(rawName(record))

export const unitPrice = (record: any): number => {
  const quote = Number(record?.Cotacao) || 0
  if (quote > 0) return quote
  const quantity = Number(record?.Quantidade) || 0
  const position = Number(record?.Posicao) || 0
  if (quantity > 0 && position > 0) return position / quantity
  return Number(record?.PrecoMedio) || 0
}

export const categoryOfRecord = (record: any, section: SectionKey): string =>
  section === 'manualAssets' ? record?.Categoria || 'Outros' : SECTION_CATEGORY[section]

export interface Asset {
  /** Ticker normalizado (maiúsculas, sem espaços nas pontas); usado para comparar. */
  key: string
  /** Nome para exibição. */
  ticker: string
  category: string
  section: SectionKey
  segment: string
  quantity: number
  avgPrice: number
  price: number
  value: number
}

function toAsset(record: any, section: SectionKey): Asset {
  const category = categoryOfRecord(record, section)
  const quantity = Number(record.Quantidade) || 0
  const price = unitPrice(record)
  const segment = [record.Segmento, record.Vencimento, record.Indexador].find((v) => v && v !== '-') ?? category
  const name = rawName(record)
  return {
    key: normalizeTicker(name),
    ticker: section === 'acoes' || section === 'fiis' ? normalizeTicker(name) : name,
    category,
    section,
    segment: String(segment),
    quantity,
    avgPrice: Number(record.PrecoMedio) || 0,
    price,
    value: Number(record.Posicao) || quantity * price,
  }
}

export function listAssets(data: PortfolioData | null): Asset[] {
  if (!data) return []
  return SECTIONS.flatMap((section) =>
    (((data as any)[section] || []) as any[]).map((record) => toAsset(record, section)),
  ).filter((asset) => asset.key !== '')
}

export function collectCategories(assetCategories: string[], portfolios: Portfolio[]): string[] {
  const used = portfolios.flatMap((p) => ((p.data?.manualAssets || []) as any[]).map((r) => r.Categoria || 'Outros'))
  return Array.from(new Set<string>([...BUILTIN_CATEGORIES, ...(assetCategories || []), ...used]))
}
