import type { Asset } from './assets'

export const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#6366F1']
export const ALL_FILTER = 'Todos'
const OTHERS_COLOR = '#52525b'
const MAX_ASSET_SLICES = 8

export interface Pill {
  label: string
  value: number
  share: number | null
}

export interface Slice {
  name: string
  value: number
  color: string
  selectable: boolean
}

export interface AssetRow {
  key: string
  ticker: string
  subtitle: string
  price: number
  avgPrice: number
  allocation: number
  returnPct: number
  value: number
  quantity: number
}

export interface PortfolioView {
  filter: string
  total: number
  base: number
  pills: Pill[]
  slices: Slice[]
  rows: AssetRow[]
}

export function categoryColor(category: string, categories: string[]): string {
  const index = categories.indexOf(category)
  return CHART_COLORS[(index >= 0 ? index : categories.length) % CHART_COLORS.length]
}

export function buildPortfolioView(assets: Asset[], categories: string[], requestedFilter: string): PortfolioView {
  const byCategory = new Map<string, number>()
  let total = 0
  for (const asset of assets) {
    byCategory.set(asset.category, (byCategory.get(asset.category) || 0) + asset.value)
    total += asset.value
  }
  const present = [
    ...categories.filter((c) => byCategory.has(c)),
    ...Array.from(byCategory.keys()).filter((c) => !categories.includes(c)),
  ]
  const filter = present.includes(requestedFilter) ? requestedFilter : ALL_FILTER
  const isAll = filter === ALL_FILTER
  const base = isAll ? total : byCategory.get(filter) || 0
  const share = (value: number, of: number) => (of > 0 ? (value / of) * 100 : 0)

  const pills: Pill[] = [
    { label: ALL_FILTER, value: total, share: null },
    ...present.map((c) => ({ label: c, value: byCategory.get(c) || 0, share: share(byCategory.get(c) || 0, total) })),
  ]

  const visible = assets.filter((a) => isAll || a.category === filter).sort((a, b) => b.value - a.value)

  let slices: Slice[]
  if (isAll) {
    slices = present
      .filter((c) => (byCategory.get(c) || 0) > 0)
      .map((c) => ({ name: c, value: byCategory.get(c) || 0, color: categoryColor(c, categories), selectable: true }))
  } else {
    const positive = visible.filter((a) => a.value > 0)
    slices = positive.slice(0, MAX_ASSET_SLICES).map((a, i) => ({
      name: a.ticker,
      value: a.value,
      color: CHART_COLORS[i % CHART_COLORS.length],
      selectable: false,
    }))
    const rest = positive.slice(MAX_ASSET_SLICES).reduce((acc, a) => acc + a.value, 0)
    if (rest > 0) slices.push({ name: 'Outros', value: rest, color: OTHERS_COLOR, selectable: false })
  }

  const rows: AssetRow[] = visible.map((a) => ({
    key: `${a.portfolioId ?? ''}:${a.section}:${a.key}`,
    ticker: a.ticker,
    subtitle: [isAll ? `${a.category} · ${a.segment}` : a.segment, a.portfolioName].filter(Boolean).join(' · '),
    price: a.price,
    avgPrice: a.avgPrice,
    allocation: share(a.value, base),
    returnPct: a.avgPrice > 0 ? ((a.price - a.avgPrice) / a.avgPrice) * 100 : 0,
    value: a.value,
    quantity: a.quantity,
  }))

  return { filter, total, base, pills, slices, rows }
}

export function donutBackground(slices: Slice[]): string {
  const base = slices.reduce((acc, s) => acc + s.value, 0)
  if (slices.length === 0 || base <= 0) return 'rgba(255,255,255,.05)'
  const gap = slices.length > 1 ? 1.2 : 0
  const stops: string[] = []
  let acc = 0
  for (const slice of slices) {
    const start = (acc / base) * 360
    const end = ((acc + slice.value) / base) * 360
    acc += slice.value
    stops.push(
      `transparent ${start}deg ${start + gap}deg`,
      `${slice.color} ${start + gap}deg ${end - gap}deg`,
      `transparent ${end - gap}deg ${end}deg`,
    )
  }
  return `conic-gradient(${stops.join(',')})`
}
