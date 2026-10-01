import type { PortfolioData } from '../store/useInvestmentStore'
import { isBuiltinCategory, listAssets } from './assets'
import type { AssetOperation } from './operations'

/** Nome da classe → meta em %. Soma 100, ou vazio quando não há estratégia. */
export type AllocationTargets = Record<string, number>

export interface CatalogClass { name: string; about: string }

/** Sugestões de classes de mercado; o usuário também pode criar classes com nome livre. */
export const CLASS_CATALOG: CatalogClass[] = [
  { name: 'Ações', about: 'Ações brasileiras negociadas na B3' },
  { name: 'FIIs', about: 'Fundos imobiliários' },
  { name: 'Renda Fixa', about: 'CDB, LCI, LCA, CRI, CRA e debêntures' },
  { name: 'Tesouro Direto', about: 'Títulos públicos federais' },
  { name: 'ETFs', about: 'Fundos de índice negociados na B3' },
  { name: 'ETFs Internacionais', about: 'Fundos de índice negociados no exterior' },
  { name: 'Exterior', about: 'Ações globais (stocks) em corretoras internacionais' },
  { name: 'BDRs', about: 'Recibos de ações estrangeiras negociados na B3' },
  { name: 'REITs', about: 'Fundos imobiliários do exterior' },
  { name: 'Cripto', about: 'Criptomoedas' },
  { name: 'Ouro', about: 'Ouro físico ou fundos lastreados em ouro' },
  { name: 'Commodities', about: 'Matérias-primas e fundos de commodities' },
  { name: 'Fiagro', about: 'Fundos das cadeias agroindustriais' },
  { name: 'FI-Infra', about: 'Fundos de infraestrutura' },
  { name: 'Fundos Multimercado', about: 'Fundos de investimento multimercado' },
  { name: 'Previdência', about: 'PGBL e VGBL' },
  { name: 'Dólar', about: 'Exposição cambial' },
  { name: 'Reserva de Emergência', about: 'Caixa de liquidez imediata' },
]

export const DEFAULT_TARGETS: AllocationTargets = { 'FIIs': 33.3, 'Ações': 33.3, 'Renda Fixa': 33.4 }

export const DEFAULT_ASSET_CATEGORIES: string[] = ['Ações', 'FIIs', 'Renda Fixa', 'Cripto', 'Exterior']

const LEGACY_KEYS: Record<string, string> = { fiis: 'FIIs', acoes: 'Ações', renda_fixa: 'Renda Fixa', rf: 'Renda Fixa' }

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const round1 = (value: number): number => Math.round(value * 10) / 10
const own = (record: Record<string, number>, key: string): number =>
  Object.prototype.hasOwnProperty.call(record, key) ? Number(record[key]) || 0 : 0
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Reescala pesos livres para somar 100 (1 casa decimal); pesos não positivos saem. */
export function normalizeWeights(weights: Record<string, number>): AllocationTargets {
  const entries = Object.entries(weights).filter(([name, weight]) => name.trim() !== '' && Number.isFinite(weight) && weight > 0)
  const sum = entries.reduce((acc, [, weight]) => acc + weight, 0)
  if (sum <= 0) return {}
  const scaled = entries.map(([name, weight]): [string, number] => [name, round1((weight / sum) * 100)])
  const residual = round1(100 - scaled.reduce((acc, [, pct]) => acc + pct, 0))
  if (residual !== 0) {
    const largest = scaled.reduce((best, entry) => (entry[1] > best[1] ? entry : best), scaled[0])
    largest[1] = round1(largest[1] + residual)
  }
  return Object.fromEntries(scaled.filter(([, pct]) => pct > 0))
}

function renameLegacyKeys(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {}
  const entries: [string, number][] = []
  for (const [key, value] of Object.entries(raw)) {
    const name = Object.prototype.hasOwnProperty.call(LEGACY_KEYS, key) ? LEGACY_KEYS[key] : key
    const pct = Number(value)
    if (!Number.isFinite(pct)) continue
    const existing = entries.find(([n]) => n === name)
    if (existing) existing[1] += pct
    else entries.push([name, pct])
  }
  return Object.fromEntries(entries)
}

/** Aceita o formato antigo `{ fiis, acoes, renda_fixa }` e o atual; devolve sempre o atual, somando 100. */
export function migrateTargets(raw: unknown): AllocationTargets {
  if (!isRecord(raw)) return { ...DEFAULT_TARGETS }
  return normalizeWeights(renameLegacyKeys(raw))
}

export function migrateSnapshot<T extends { targets?: unknown; current?: unknown }>(
  snapshot: T,
): T & { targets: Record<string, number>; current: Record<string, number> } {
  return { ...snapshot, targets: renameLegacyKeys(snapshot?.targets), current: renameLegacyKeys(snapshot?.current) }
}

export interface AllocationRow {
  name: string
  value: number
  currentPct: number
  targetPct: number
  /** Atual menos meta, em pontos percentuais. */
  diffPct: number
  builtin: boolean
  hasAssets: boolean
  inStrategy: boolean
}

/** Uma linha por classe que tem meta ou ativos; a coluna atual sempre soma 100 quando há ativos. */
export function computeAllocation(data: PortfolioData | null, targets: AllocationTargets, categories: string[]): AllocationRow[] {
  const values = new Map<string, number>()
  for (const asset of listAssets(data)) values.set(asset.category, (values.get(asset.category) || 0) + asset.value)
  const total = Array.from(values.values()).reduce((acc, value) => acc + value, 0)
  const names = Array.from(new Set([...categories, ...Object.keys(targets), ...values.keys()]))
  return names
    .map((name) => {
      const value = values.get(name) || 0
      const currentPct = total > 0 ? (value / total) * 100 : 0
      const targetPct = own(targets, name)
      return {
        name, value, currentPct, targetPct,
        diffPct: currentPct - targetPct,
        builtin: isBuiltinCategory(name),
        hasAssets: value > 0,
        inStrategy: Object.prototype.hasOwnProperty.call(targets, name),
      }
    })
    .filter((row) => row.inStrategy || row.hasAssets)
}

/** Mantém as metas coerentes quando categorias são renomeadas ou excluídas. */
export function retargetAfterCategoryOps(targets: AllocationTargets, operations: AssetOperation[], categories: string[]): AllocationTargets {
  let entries = Object.entries(targets)
  const canonical = (name: string) => categories.find((c) => sameName(c, name)) ?? name.trim()
  const indexOf = (name: string) => entries.findIndex(([key]) => sameName(key, name))
  for (const op of operations) {
    if (op.type === 'rename_category') {
      const index = indexOf(op.from || '')
      if (index >= 0) entries[index] = [(op.to || '').trim(), entries[index][1]]
    } else if (op.type === 'remove_category') {
      const index = indexOf(op.name || '')
      if (index < 0) continue
      const [, pct] = entries[index]
      entries = entries.filter((_, i) => i !== index)
      if (op.moveTo) {
        const destination = indexOf(op.moveTo)
        if (destination >= 0) entries[destination] = [entries[destination][0], round1(entries[destination][1] + pct)]
        else entries.push([canonical(op.moveTo), pct])
      } else {
        entries = Object.entries(normalizeWeights(Object.fromEntries(entries)))
      }
    }
  }
  return Object.fromEntries(entries)
}
