import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PortfolioData {
  fiis: any[]
  acoes: any[]
  tesouro: any[]
  renda_fixa: any[]
  manualAssets: any[]
  dividendos: any[]
  total_live: number
  resumo: {
    total_investido: number
    saldo_disponivel: number
    saldo_projetado: number
  }
}

export interface ColumnMapping {
  ticker: number | null;
  position: number | null;
  allocation: number | null;
  price: number | null;
  quantity: number | null;
  avgPrice?: number | null;
  extra?: number | null; // e.g. Vencimento
  indexador?: number | null;
  grossValue?: number | null;
  netValue?: number | null;
}

export interface SectionConfig {
  id: string;
  name: string;
  trigger: string;
  type: 'fiis' | 'acoes' | 'tesouro' | 'renda_fixa' | 'dividendos';
  mapping: ColumnMapping;
  sheetName?: string;
}

export interface ImportConfig {
  sections: SectionConfig[];
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

export interface MonthlyItem {
  id: string
  name: string
  value: number
  category: string
}

export interface MonthlyPlan {
  incomes: MonthlyItem[]
  expenses: MonthlyItem[]
  categories: string[]
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
  addManualAsset: (asset: { ticker: string; category: string; quantity: number; averagePrice: number }) => void
  deleteManualAsset: (id: string) => void
  addAssetCategory: (category: string) => void
  updatePortfolioPrices: (quotes: any[]) => void
  loadBackup: (data: any) => void
  setMonthlyPlan: (plan: MonthlyPlan) => void
  monthlyPlan: MonthlyPlan
  assetCategories: string[]
  contributionAmount: number
  setContributionAmount: (amount: number) => void
  importConfig: ImportConfig
  setImportConfig: (config: ImportConfig) => void
  updateAsset: (type: string, ticker: string, updates: any) => void
  historicalTransactions: any[]
  setHistoricalTransactions: (transactions: any[]) => void
  activeTab: string
  setActiveTab: (tab: string) => void
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
      historicalTransactions: [],
      setHistoricalTransactions: (historicalTransactions) => set({ historicalTransactions }),
      activeTab: 'dashboard',
      setActiveTab: (activeTab) => set({ activeTab }),
      monthlyPlan: {
        incomes: [],
        expenses: [],
        categories: ['Salário', 'Investimentos', 'Aluguel', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Outros']
      },
      assetCategories: ['Ações', 'FIIs', 'Renda Fixa', 'Cripto', 'Exterior'],
      contributionAmount: 1000,
      importConfig: {
        sections: [
          {
            id: 'fiis',
            name: 'Fundos Imobiliários',
            trigger: 'Fundos Listados',
            type: 'fiis',
            mapping: { ticker: 0, position: 1, allocation: 2, price: 6, quantity: 7 }
          },
          {
            id: 'acoes',
            name: 'Ações',
            trigger: 'Renda Variável Brasil',
            type: 'acoes',
            mapping: { ticker: 0, position: 1, allocation: 2, price: 5, quantity: 6 }
          },
          {
            id: 'tesouro',
            name: 'Tesouro Direto',
            trigger: 'Tesouro Direto',
            type: 'tesouro',
            mapping: { ticker: 0, position: 1, allocation: 2, price: 3, quantity: 4 }
          },
          {
            id: 'renda_fixa',
            name: 'Renda Fixa',
            trigger: 'Renda Fixa',
            type: 'renda_fixa',
            mapping: { ticker: 0, position: 1, allocation: 2, price: 3, quantity: 8, extra: 7 }
          }
        ]
      },

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
      addManualAsset: (asset) => set((state) => {
        if (!state.portfolio) return state;
        const newAsset = {
          id: crypto.randomUUID(),
          Ticker: asset.ticker.toUpperCase(),
          Categoria: asset.category,
          Quantidade: asset.quantity,
          PrecoMedio: asset.averagePrice,
          Cotacao: asset.averagePrice, // Default to average price until updated
          Posicao: asset.quantity * asset.averagePrice,
          Segmento: asset.category,
        };
        const newManualAssets = [...(state.portfolio.manualAssets || []), newAsset];
        const newTotalLive = [...state.portfolio.acoes, ...state.portfolio.fiis, ...state.portfolio.tesouro, ...state.portfolio.renda_fixa, ...newManualAssets]
          .reduce((acc, curr) => acc + (curr.Posicao || 0), 0);
          
        const originalInvested = state.portfolio.resumo?.total_investido || 0;
        
        return {
          portfolio: {
            ...state.portfolio,
            manualAssets: newManualAssets,
            total_live: newTotalLive,
            resumo: {
              ...state.portfolio.resumo,
              total_investido: originalInvested + (newAsset.Quantidade * newAsset.PrecoMedio)
            }
          }
        };
      }),
      deleteManualAsset: (id) => set((state) => {
        if (!state.portfolio) return state;
        const assetToRemove = (state.portfolio.manualAssets || []).find((a: any) => a.id === id);
        const newManualAssets = (state.portfolio.manualAssets || []).filter((a: any) => a.id !== id);
        const newTotalLive = [...state.portfolio.acoes, ...state.portfolio.fiis, ...state.portfolio.tesouro, ...state.portfolio.renda_fixa, ...newManualAssets]
          .reduce((acc, curr) => acc + (curr.Posicao || 0), 0);

        const deduction = assetToRemove ? (assetToRemove.Quantidade * assetToRemove.PrecoMedio) : 0;

        return {
          portfolio: {
            ...state.portfolio,
            manualAssets: newManualAssets,
            total_live: newTotalLive,
            resumo: {
              ...state.portfolio.resumo,
              total_investido: (state.portfolio.resumo?.total_investido || 0) - deduction
            }
          }
        };
      }),
      addAssetCategory: (category) => set((state) => ({
        assetCategories: Array.from(new Set([...state.assetCategories, category]))
      })),
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
        const newManual = updateSection(state.portfolio.manualAssets || []);
        
        const newTotalLive = [...newAcoes, ...newFiis, ...state.portfolio.tesouro, ...state.portfolio.renda_fixa, ...newManual]
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
            manualAssets: newManual,
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
        monthlyPlan: data.monthlyPlan || { incomes: [], expenses: [], categories: ['Salário', 'Investimentos', 'Aluguel', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Outros'] },
        assetCategories: data.assetCategories || ['Ações', 'FIIs', 'Renda Fixa', 'Cripto', 'Exterior'],
        contributionAmount: data.contributionAmount || 1000,
      }),
      setMonthlyPlan: (monthlyPlan) => set({ monthlyPlan }),
      setContributionAmount: (contributionAmount) => set({ contributionAmount }),
      setImportConfig: (importConfig) => set({ importConfig }),
      updateAsset: (type, identifier, updates) => set((state) => {
        if (!state.portfolio) return state;
        
        const sectionMap: any = {
          'acoes': 'acoes',
          'fiis': 'fiis',
          'tesouro': 'tesouro',
          'renda_fixa': 'renda_fixa',
          'manual': 'manualAssets'
        };

        const sectionKey = sectionMap[type] || type;
        const section = (state.portfolio as any)[sectionKey] || [];
        
        const newSection = section.map((a: any) => 
          (a.Ticker === identifier || a.id === identifier) ? { ...a, ...updates } : a
        );

        const newPortfolio = { ...state.portfolio, [sectionKey]: newSection };
        
        // Recalculate totals
        const all = [
          ...newPortfolio.acoes,
          ...newPortfolio.fiis,
          ...newPortfolio.tesouro,
          ...newPortfolio.renda_fixa,
          ...(newPortfolio.manualAssets || [])
        ];

        const newTotalLive = all.reduce((acc: number, curr: any) => acc + (curr.Posicao || 0), 0);
        const newTotalInvested = all.reduce((acc: number, curr: any) => acc + ((curr.PrecoMedio || 0) * (curr.Quantidade || 0)), 0);

        return {
          portfolio: {
            ...newPortfolio,
            total_live: newTotalLive,
            resumo: {
              ...newPortfolio.resumo,
              total_investido: newTotalInvested
            }
          }
        };
      }),
    }),
    {
      name: 'investment-storage',
    }
  )
)
