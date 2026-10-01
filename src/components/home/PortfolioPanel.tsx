import { useMemo, useState } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { collectCategories, listAssets } from '../../domain/assets'
import { ALL_FILTER, buildPortfolioView, donutBackground } from '../../domain/portfolioView'
import { useQuoteRefresh } from '../../hooks/useQuoteRefresh'
import { brl, num, pct } from '../../lib/format'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'

const CARD = 'bg-card border border-white/10 rounded-[32px] p-6 shadow-2xl'
const ROW_GRID = 'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,.9fr)_minmax(0,.8fr)_minmax(0,1.2fr)] gap-2'
const DONUT_MASK = 'radial-gradient(farthest-side, transparent 69.5%, #000 70%)'

const wholeBrl = (value: number) => brl(value).replace(/,\d+$/, '')
const signedPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2).replace('.', ',')}%`

export const PortfolioPanel = () => {
  const portfolio = useInvestmentStore((s) => s.portfolio)
  const portfolios = useInvestmentStore((s) => s.portfolios)
  const assetCategories = useInvestmentStore((s) => s.assetCategories)
  const [requestedFilter, setFilter] = useState(ALL_FILTER)
  useQuoteRefresh()

  const view = useMemo(
    () => buildPortfolioView(listAssets(portfolio), collectCategories(assetCategories, portfolios), requestedFilter),
    [portfolio, portfolios, assetCategories, requestedFilter],
  )
  const isAll = view.filter === ALL_FILTER

  if (view.rows.length === 0 && isAll) {
    return (
      <section className={`${CARD} flex flex-col items-center justify-center gap-4 text-center min-h-0`}>
        <Wallet size={48} className="text-white/20" />
        <h3 className="text-xl font-black text-white">Nenhum ativo ainda</h3>
        <p className="text-sm text-white/40 max-w-sm">
          Envie uma planilha ou registre uma compra no chat para ver sua carteira aqui.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4 min-h-0">
      <div className="flex flex-wrap gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl shrink-0">
        {view.pills.map((pill) => {
          const active = pill.label === view.filter
          return (
            <button
              key={pill.label}
              type="button"
              data-testid={`pill-${pill.label}`}
              onClick={() => setFilter(pill.label)}
              className={`flex-[1_0_auto] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap transition-colors ${
                active ? 'bg-primary text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <span className="text-xs font-bold">{pill.label}</span>
              <span className="text-[10px] font-black opacity-70">
                {pill.share === null ? wholeBrl(pill.value) : pct(pill.share)}
              </span>
            </button>
          )
        })}
      </div>

      <div className={`${CARD} shrink-0`}>
        <div className="flex justify-between items-center gap-3 mb-4">
          <h3 className="text-lg font-black tracking-tight text-white/90">Composição</h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/30 text-right">
            {isAll ? '% da carteira por categoria' : `% dentro de ${view.filter}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-5 items-center justify-center">
          <div className="relative w-[200px] h-[200px] shrink-0">
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: donutBackground(view.slices), mask: DONUT_MASK, WebkitMask: DONUT_MASK }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-xs text-white/30 uppercase font-black tracking-tight">{view.filter}</div>
              <div className="text-lg font-black text-white/90">{brl(view.base)}</div>
            </div>
          </div>
          <div className="flex-[1_1_200px] min-w-0 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-1.5">
            {view.slices.map((slice) => (
              <button
                key={slice.name}
                type="button"
                data-testid={`legend-${slice.name}`}
                disabled={!slice.selectable}
                onClick={() => setFilter(slice.name)}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] text-white text-left enabled:hover:bg-white/5 disabled:cursor-default"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: slice.color }} />
                  <span className="text-[13px] font-black text-white/80 truncate">{slice.name}</span>
                </span>
                <span className="flex flex-col items-end shrink-0">
                  <span className="text-[13px] font-black text-white/90">
                    {pct(view.base > 0 ? (slice.value / view.base) * 100 : 0)}
                  </span>
                  <span className="text-[11px] text-white/30 font-bold tracking-tighter">{brl(slice.value)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`${CARD} flex-1 min-h-0 flex flex-col`}>
        <div className="flex justify-between items-center gap-3 mb-2">
          <div className="flex items-baseline gap-2.5 whitespace-nowrap min-w-0">
            <h3 className="text-lg font-black tracking-tight text-white/90">Ativos Detalhados</h3>
            <span className="text-[11px] font-bold text-white/30">
              {view.rows.length} {view.rows.length === 1 ? 'ativo' : 'ativos'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => useChatStore.getState().requestCompose('Comprei ')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary/20 transition-colors"
          >
            <Plus size={16} />
            <span className="text-xs font-black uppercase tracking-tight">Adicionar</span>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          <div className="min-w-[520px]">
            <div
              className={`${ROW_GRID} px-2 py-3.5 border-b border-white/5 text-xs text-white/40 uppercase font-black tracking-widest sticky top-0 bg-card`}
            >
              <span>Ativo</span>
              <span>Cotação</span>
              <span>{isAll ? 'Aloc.' : 'Aloc. cat.'}</span>
              <span className="text-right">Rent.</span>
              <span className="text-right">Valor</span>
            </div>
            {view.rows.map((row) => (
              <div
                key={row.key}
                data-testid="asset-row"
                className={`${ROW_GRID} px-2 py-3.5 border-b border-white/5 items-center text-sm hover:bg-white/5`}
              >
                <div className="min-w-0">
                  <div data-testid="asset-ticker" className="font-black tracking-tight truncate">
                    {row.ticker}
                  </div>
                  <div className="text-[11px] text-white/20 font-bold truncate">{row.subtitle}</div>
                </div>
                <div>
                  <div className="font-bold text-white/90">{brl(row.price)}</div>
                  <div className="text-[10px] text-white/20">PM: {brl(row.avgPrice)}</div>
                </div>
                <div className="flex flex-col gap-[5px]">
                  <span className="font-bold text-primary/80">{pct(row.allocation)}</span>
                  <span className="h-[3px] rounded-sm bg-white/5 overflow-hidden max-w-[72px]">
                    <span
                      className="block h-full rounded-sm bg-primary"
                      style={{ width: `${Math.min(100, row.allocation)}%` }}
                    />
                  </span>
                </div>
                <div className={`text-right font-bold ${row.returnPct >= 0 ? 'text-primary' : 'text-red-500'}`}>
                  {signedPct(row.returnPct)}
                </div>
                <div className="text-right">
                  <div className="font-black text-white/90">{brl(row.value)}</div>
                  <div className="text-[11px] text-white/20 font-medium">{num(row.quantity)} un.</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
