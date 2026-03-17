import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PortfolioData {
  fiis: any[]
  acoes: any[]
  tesouro: any[]
  renda_fixa: any[]
  dividendos: any[]
  total_live: number
  resumo: {
    total_investido: number
    saldo_disponivel: number
    saldo_projetado: number
  }
}

interface Snapshot {
  id: string
  date: string
  portfolio_total: number
  aporte: number
  targets: { fiis: number; acoes: number; rf: number }
  current: { fiis: number; acoes: number; rf: number }
  result: string
}

interface InvestmentStore {
  portfolio: PortfolioData | null
  settings: {
    estrategia: string
    alvos: { fiis: number; acoes: number; renda_fixa: number }
  }
  snapshots: Snapshot[]
  customLists: any[]
  equityHistory: { date: string; total: number }[]
  
  setPortfolio: (data: PortfolioData) => void
  setSettings: (settings: any) => void
  addSnapshot: (snapshot: Snapshot) => void
  deleteSnapshot: (id: string) => void
  updateSnapshotResult: (id: string, result: string) => void
  addCustomList: (name: string) => void
  deleteCustomList: (id: string) => void
  addTickerToList: (listId: string, ticker: string) => void
  removeTickerFromList: (listId: string, ticker: string) => void
  addHistoryEntry: (total: number) => void
  updatePortfolioPrices: (quotes: any[]) => void
  loadBackup: (data: any) => void
}

export const useInvestmentStore = create<InvestmentStore>()(
  persist(
    (set) => ({
      portfolio: null,
      settings: {
        estrategia: '',
        alvos: { fiis: 33.3, acoes: 33.3, renda_fixa: 33.4 },
      },
      snapshots: [],
      customLists: [],
      equityHistory: [],

      setPortfolio: (portfolio) => set({ portfolio }),
      setSettings: (settings) => set({ settings }),
      addSnapshot: (snapshot) => set((state) => ({ snapshots: [snapshot, ...state.snapshots] })),
      deleteSnapshot: (id) => set((state) => ({ snapshots: state.snapshots.filter((s) => s.id !== id) })),
      updateSnapshotResult: (id, result) => set((state) => ({
        snapshots: state.snapshots.map((s) => s.id === id ? { ...s, result } : s)
      })),
      addCustomList: (name) => set((state) => ({
        customLists: [...state.customLists, { id: crypto.randomUUID(), name, items: [] }]
      })),
      deleteCustomList: (id) => set((state) => ({
        customLists: state.customLists.filter(l => l.id !== id)
      })),
      addTickerToList: (listId, ticker) => set((state) => ({
        customLists: state.customLists.map(l => 
          l.id === listId 
            ? { ...l, items: [...l.items.filter((i: any) => i.ticker !== ticker), { ticker: ticker.toUpperCase(), price: 0, change: 0 }] } 
            : l
        )
      })),
      removeTickerFromList: (listId, ticker) => set((state) => ({
        customLists: state.customLists.map(l => 
          l.id === listId 
            ? { ...l, items: l.items.filter((i: any) => i.ticker !== ticker) } 
            : l
        )
      })),
      addHistoryEntry: (total) => set((state) => {
        const date = new Date().toISOString().split('T')[0];
        const newHistory = [...state.equityHistory.filter(h => h.date !== date), { date, total }];
        return { equityHistory: newHistory.sort((a, b) => a.date.localeCompare(b.date)).slice(-12) };
      }),
      updatePortfolioPrices: (quotes) => set((state) => {
        if (!state.portfolio) return state;

        const updateSection = (section: any[]) => section.map(asset => {
          const quote = quotes.find(q => q.symbol === asset.Ticker);
          if (quote) {
            const newPrice = quote.regularMarketPrice;
            return {
              ...asset,
              Cotacao: newPrice,
              Posicao: asset.Quantidade * newPrice,
              Segmento: quote.sector || asset.Segmento,
              pl: quote.priceEarnings,
              pvp: quote.priceToBook,
              dy: quote.dividendYield,
            };
          }
          return asset;
        });

        const newAcoes = updateSection(state.portfolio.acoes);
        const newFiis = updateSection(state.portfolio.fiis);
        
        const newTotalLive = [...newAcoes, ...newFiis, ...state.portfolio.tesouro, ...state.portfolio.renda_fixa]
          .reduce((acc, curr) => acc + (curr.Posicao || 0), 0);

        const newCustomLists = state.customLists.map(list => ({
          ...list,
          items: list.items.map((item: any) => {
            const quote = quotes.find(q => q.symbol === item.ticker);
            if (quote) {
              return {
                ...item,
                price: quote.regularMarketPrice,
                change: quote.regularMarketChangePercent,
                pl: quote.priceEarnings,
                pvp: quote.priceToBook,
                dy: quote.dividendYield,
              };
            }
            return item;
          })
        }));

        return {
          portfolio: {
            ...state.portfolio,
            acoes: newAcoes,
            fiis: newFiis,
            total_live: newTotalLive,
          },
          customLists: newCustomLists
        };
      }),
      loadBackup: (data) => set({
        portfolio: data.portfolio || null,
        settings: data.settings || { estrategia: '', alvos: { fiis: 33.3, acoes: 33.3, renda_fixa: 33.4 } },
        snapshots: data.snapshots || [],
        customLists: data.customLists || [],
        equityHistory: data.equityHistory || [],
      }),
    }),
    {
      name: 'investment-storage',
    }
  )
)
