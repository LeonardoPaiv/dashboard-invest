import { useEffect, useRef } from 'react'
import { fetchQuotes } from '../services/brapi'
import { useInvestmentStore } from '../store/useInvestmentStore'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

function quotableTickers(): string[] {
  const { portfolio, customLists } = useInvestmentStore.getState()
  const fromPortfolio = [
    ...(portfolio?.acoes || []),
    ...(portfolio?.fiis || []),
    ...(portfolio?.manualAssets || []),
  ].map((asset: any) => asset.Ticker)
  const fromLists = (customLists || []).flatMap((list: any) => (list.items || []).map((item: any) => item.ticker))
  return Array.from(new Set<string>([...fromPortfolio, ...fromLists].filter(Boolean))).sort()
}

/** Busca cotações ao montar, a cada 5 minutos e quando o conjunto de tickers muda. */
export function useQuoteRefresh(): void {
  const tickerKey = useInvestmentStore(() => quotableTickers().join(','))
  const busy = useRef(false)

  useEffect(() => {
    const refresh = async () => {
      const tickers = quotableTickers()
      if (busy.current || tickers.length === 0) return
      busy.current = true
      try {
        const quotes = await fetchQuotes(tickers)
        if (quotes.length > 0) {
          const store = useInvestmentStore.getState()
          store.updatePortfolioPrices(quotes)
          store.addHistoryEntry(useInvestmentStore.getState().portfolio?.total_live || 0)
        }
      } catch (error) {
        console.error('Erro ao atualizar cotações:', error)
      } finally {
        busy.current = false
      }
    }

    void refresh()
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [tickerKey])
}
