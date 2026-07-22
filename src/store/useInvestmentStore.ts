import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PortfolioData {
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

export interface Portfolio {
  id: string
  name: string
  color?: string
  data: PortfolioData
  createdAt: string
  updatedAt: string
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

export interface MonthlySnapshot {
  id: string
  date: string // ISO date or "MM/YYYY"
  incomes: MonthlyItem[]
  expenses: MonthlyItem[]
  totalIncome: number
  totalExpense: number
  savings: number
}

const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#3b82f6'];

export const createEmptyPortfolioData = (): PortfolioData => ({
  fiis: [],
  acoes: [],
  tesouro: [],
  renda_fixa: [],
  manualAssets: [],
  dividendos: [],
  total_live: 0,
  resumo: {
    total_investido: 0,
    saldo_disponivel: 0,
    saldo_projetado: 0
  }
});

export const getConsolidatedPortfolioData = (portfolios: Portfolio[]): PortfolioData | null => {
  if (!portfolios || portfolios.length === 0) return null;

  let fiis: any[] = [];
  let acoes: any[] = [];
  let tesouro: any[] = [];
  let renda_fixa: any[] = [];
  let manualAssets: any[] = [];
  let dividendos: any[] = [];
  let total_live = 0;
  let total_investido = 0;
  let saldo_disponivel = 0;
  let saldo_projetado = 0;

  portfolios.forEach((p) => {
    const d = p.data;
    if (!d) return;

    const tagAssets = (arr: any[]) =>
      (arr || []).map((item) => ({
        ...item,
        portfolioId: p.id,
        portfolioName: p.name,
        portfolioColor: p.color || '#6366f1'
      }));

    fiis = fiis.concat(tagAssets(d.fiis));
    acoes = acoes.concat(tagAssets(d.acoes));
    tesouro = tesouro.concat(tagAssets(d.tesouro));
    renda_fixa = renda_fixa.concat(tagAssets(d.renda_fixa));
    manualAssets = manualAssets.concat(tagAssets(d.manualAssets));
    dividendos = dividendos.concat(tagAssets(d.dividendos));

    total_live += d.total_live || 0;
    if (d.resumo) {
      total_investido += d.resumo.total_investido || 0;
      saldo_disponivel += d.resumo.saldo_disponivel || 0;
      saldo_projetado += d.resumo.saldo_projetado || 0;
    }
  });

  return {
    fiis,
    acoes,
    tesouro,
    renda_fixa,
    manualAssets,
    dividendos,
    total_live,
    resumo: {
      total_investido,
      saldo_disponivel,
      saldo_projetado
    }
  };
};

export const mergePortfolioData = (existing: PortfolioData, incoming: PortfolioData): PortfolioData => {
  const mergeList = (existingList: any[], incomingList: any[], keyField: string = 'Ticker') => {
    const map = new Map<string, any>();
    (existingList || []).forEach((item) => {
      const key = (item[keyField] || item.Ticker || item.Titulo || item.Ativo || item.id || '').toUpperCase();
      if (key) map.set(key, { ...item });
    });
    (incomingList || []).forEach((item) => {
      const key = (item[keyField] || item.Ticker || item.Titulo || item.Ativo || item.id || '').toUpperCase();
      if (key && map.has(key)) {
        const prev = map.get(key);
        const newQty = (prev.Quantidade || 0) + (item.Quantidade || 0);
        const prevCost = (prev.Quantidade || 0) * (prev.PrecoMedio || 0);
        const newCost = (item.Quantidade || 0) * (item.PrecoMedio || item.Cotacao || 0);
        const totalQty = newQty > 0 ? newQty : item.Quantidade || prev.Quantidade || 0;
        const avgPrice = totalQty > 0 ? (prevCost + newCost) / totalQty : item.PrecoMedio || prev.PrecoMedio || 0;

        map.set(key, {
          ...prev,
          ...item,
          Quantidade: totalQty,
          PrecoMedio: avgPrice,
          Posicao: totalQty * (item.Cotacao || prev.Cotacao || avgPrice)
        });
      } else if (key) {
        map.set(key, { ...item });
      }
    });
    return Array.from(map.values());
  };

  const fiis = mergeList(existing.fiis, incoming.fiis);
  const acoes = mergeList(existing.acoes, incoming.acoes);
  const tesouro = mergeList(existing.tesouro, incoming.tesouro);
  const renda_fixa = mergeList(existing.renda_fixa, incoming.renda_fixa);
  const manualAssets = mergeList(existing.manualAssets, incoming.manualAssets);
  const dividendos = [...(existing.dividendos || []), ...(incoming.dividendos || [])];

  const all = [...fiis, ...acoes, ...tesouro, ...renda_fixa, ...manualAssets];
  const total_live = all.reduce((acc, curr) => acc + (curr.Posicao || 0), 0);
  const total_investido = all.reduce((acc, curr) => acc + ((curr.PrecoMedio || 0) * (curr.Quantidade || 0)), 0);

  return {
    fiis,
    acoes,
    tesouro,
    renda_fixa,
    manualAssets,
    dividendos,
    total_live,
    resumo: {
      total_investido,
      saldo_disponivel: (existing.resumo?.saldo_disponivel || 0) + (incoming.resumo?.saldo_disponivel || 0),
      saldo_projetado: (existing.resumo?.saldo_projetado || 0) + (incoming.resumo?.saldo_projetado || 0)
    }
  };
};

interface InvestmentStore {
  portfolios: Portfolio[]
  activePortfolioId: string // 'all' or portfolio ID
  portfolio: PortfolioData | null // Derived / computed current active portfolio view

  settings: {
    estrategia: string
    alvos: { fiis: number; acoes: number; renda_fixa: number }
  }
  snapshots: Snapshot[]
  customLists: any[]
  equityHistory: { date: string; total: number }[]
  monthlySnapshots: MonthlySnapshot[]
  
  // Multi-portfolio actions
  setActivePortfolio: (id: string) => void
  addPortfolio: (name: string, initialData?: PortfolioData, color?: string) => string
  renamePortfolio: (id: string, name: string) => void
  deletePortfolio: (id: string) => void
  setPortfolioData: (portfolioId: string, data: PortfolioData, mode?: 'replace' | 'merge') => void

  // Backward-compatible actions
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
  addManualAsset: (asset: { ticker: string; category: string; quantity: number; averagePrice: number }, targetPortfolioId?: string) => void
  deleteManualAsset: (id: string, targetPortfolioId?: string) => void
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
  addMonthlySnapshot: (snapshot: MonthlySnapshot, resetExpenses: boolean) => void
  deleteMonthlySnapshot: (id: string) => void
  updateAsset: (type: string, ticker: string, updates: any, targetPortfolioId?: string) => void
  historicalTransactions: any[]
  setHistoricalTransactions: (transactions: any[]) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  clearAllData: () => void
}

const updatePortfolioDerivedView = (portfolios: Portfolio[], activePortfolioId: string): PortfolioData | null => {
  if (activePortfolioId === 'all') {
    return getConsolidatedPortfolioData(portfolios);
  }
  const found = portfolios.find((p) => p.id === activePortfolioId);
  if (found) return found.data;
  return portfolios.length > 0 ? portfolios[0].data : null;
};

export const useInvestmentStore = create<InvestmentStore>()(
  persist(
    (set, get) => ({
      portfolios: [
        {
          id: 'default',
          name: 'Carteira Principal',
          color: '#6366f1',
          data: createEmptyPortfolioData(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      activePortfolioId: 'default',
      portfolio: null,

      settings: {
        estrategia: '',
        alvos: { fiis: 33.3, acoes: 33.3, renda_fixa: 33.4 },
      },
      snapshots: [],
      customLists: [],
      equityHistory: [],
      monthlySnapshots: [],
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

      setActivePortfolio: (id) => set((state) => ({
        activePortfolioId: id,
        portfolio: updatePortfolioDerivedView(state.portfolios, id)
      })),

      addPortfolio: (name, initialData, color) => {
        const id = crypto.randomUUID();
        const newColor = color || DEFAULT_COLORS[get().portfolios.length % DEFAULT_COLORS.length];
        const newPortfolio: Portfolio = {
          id,
          name: name.trim() || 'Nova Carteira',
          color: newColor,
          data: initialData || createEmptyPortfolioData(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        set((state) => {
          const updatedPortfolios = [...state.portfolios, newPortfolio];
          return {
            portfolios: updatedPortfolios,
            activePortfolioId: id,
            portfolio: newPortfolio.data
          };
        });

        return id;
      },

      renamePortfolio: (id, name) => set((state) => {
        const updatedPortfolios = state.portfolios.map((p) =>
          p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: new Date().toISOString() } : p
        );
        return {
          portfolios: updatedPortfolios,
          portfolio: updatePortfolioDerivedView(updatedPortfolios, state.activePortfolioId)
        };
      }),

      deletePortfolio: (id) => set((state) => {
        if (state.portfolios.length <= 1) {
          // Keep at least one empty portfolio
          const defaultP: Portfolio = {
            id: 'default',
            name: 'Carteira Principal',
            color: '#6366f1',
            data: createEmptyPortfolioData(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          return {
            portfolios: [defaultP],
            activePortfolioId: 'default',
            portfolio: defaultP.data
          };
        }

        const updatedPortfolios = state.portfolios.filter((p) => p.id !== id);
        const nextActiveId = state.activePortfolioId === id ? updatedPortfolios[0].id : state.activePortfolioId;

        return {
          portfolios: updatedPortfolios,
          activePortfolioId: nextActiveId,
          portfolio: updatePortfolioDerivedView(updatedPortfolios, nextActiveId)
        };
      }),

      setPortfolioData: (portfolioId, newData, mode = 'replace') => set((state) => {
        const updatedPortfolios = state.portfolios.map((p) => {
          if (p.id === portfolioId) {
            const updatedData = mode === 'merge' ? mergePortfolioData(p.data, newData) : newData;
            return {
              ...p,
              data: updatedData,
              updatedAt: new Date().toISOString()
            };
          }
          return p;
        });

        return {
          portfolios: updatedPortfolios,
          portfolio: updatePortfolioDerivedView(updatedPortfolios, state.activePortfolioId)
        };
      }),

      setPortfolio: (data) => set((state) => {
        let targetId = state.activePortfolioId;
        if (targetId === 'all' || !state.portfolios.some((p) => p.id === targetId)) {
          targetId = state.portfolios[0]?.id || 'default';
        }

        const updatedPortfolios = state.portfolios.map((p) =>
          p.id === targetId ? { ...p, data, updatedAt: new Date().toISOString() } : p
        );

        return {
          portfolios: updatedPortfolios,
          portfolio: updatePortfolioDerivedView(updatedPortfolios, targetId)
        };
      }),

      setSettings: (settings) => set({ settings }),
      addSnapshot: (snapshot) => set((state) => ({ snapshots: [snapshot, ...state.snapshots] })),
      deleteSnapshot: (id) => set((state) => ({ snapshots: state.snapshots.filter((s) => s.id !== id) })),
      updateSnapshotResult: (id, result) => set((state) => ({
        snapshots: state.snapshots.map((s) => (s.id === id ? { ...s, result } : s))
      })),
      addCustomList: (name) => set((state) => ({
        customLists: [...state.customLists, { id: crypto.randomUUID(), name, items: [] }]
      })),
      deleteCustomList: (id) => set((state) => ({
        customLists: state.customLists.filter((l) => l.id !== id)
      })),
      addTickerToList: (listId, ticker) => set((state) => ({
        customLists: state.customLists.map((l) =>
          l.id === listId
            ? { ...l, items: [...l.items.filter((i: any) => i.ticker !== ticker), { ticker: ticker.toUpperCase(), price: 0, change: 0 }] }
            : l
        )
      })),
      removeTickerFromList: (listId, ticker) => set((state) => ({
        customLists: state.customLists.map((l) =>
          l.id === listId ? { ...l, items: l.items.filter((i: any) => i.ticker !== ticker) } : l
        )
      })),
      addHistoryEntry: (total) => set((state) => {
        const date = new Date().toISOString().split('T')[0];
        const newHistory = [...state.equityHistory.filter((h) => h.date !== date), { date, total }];
        return { equityHistory: newHistory.sort((a, b) => a.date.localeCompare(b.date)).slice(-12) };
      }),

      addManualAsset: (asset, targetPortfolioId) => set((state) => {
        let pId = targetPortfolioId || state.activePortfolioId;
        if (pId === 'all' || !state.portfolios.some((p) => p.id === pId)) {
          pId = state.portfolios[0]?.id || 'default';
        }

        const updatedPortfolios = state.portfolios.map((p) => {
          if (p.id === pId) {
            const newAsset = {
              id: crypto.randomUUID(),
              Ticker: asset.ticker.toUpperCase(),
              Categoria: asset.category,
              Quantidade: asset.quantity,
              PrecoMedio: asset.averagePrice,
              Cotacao: asset.averagePrice,
              Posicao: asset.quantity * asset.averagePrice,
              Segmento: asset.category,
            };
            const newManualAssets = [...(p.data.manualAssets || []), newAsset];
            const newTotalLive = [...p.data.acoes, ...p.data.fiis, ...p.data.tesouro, ...p.data.renda_fixa, ...newManualAssets]
              .reduce((acc, curr) => acc + (curr.Posicao || 0), 0);
            const originalInvested = p.data.resumo?.total_investido || 0;

            return {
              ...p,
              updatedAt: new Date().toISOString(),
              data: {
                ...p.data,
                manualAssets: newManualAssets,
                total_live: newTotalLive,
                resumo: {
                  ...p.data.resumo,
                  total_investido: originalInvested + (newAsset.Quantidade * newAsset.PrecoMedio)
                }
              }
            };
          }
          return p;
        });

        return {
          portfolios: updatedPortfolios,
          portfolio: updatePortfolioDerivedView(updatedPortfolios, state.activePortfolioId)
        };
      }),

      deleteManualAsset: (id, targetPortfolioId) => set((state) => {
        let pId = targetPortfolioId || state.activePortfolioId;
        
        const updatedPortfolios = state.portfolios.map((p) => {
          if (pId === 'all' || p.id === pId) {
            const assetToRemove = (p.data.manualAssets || []).find((a: any) => a.id === id);
            if (!assetToRemove && pId === 'all') return p;

            const newManualAssets = (p.data.manualAssets || []).filter((a: any) => a.id !== id);
            const newTotalLive = [...p.data.acoes, ...p.data.fiis, ...p.data.tesouro, ...p.data.renda_fixa, ...newManualAssets]
              .reduce((acc, curr) => acc + (curr.Posicao || 0), 0);

            const deduction = assetToRemove ? (assetToRemove.Quantidade * assetToRemove.PrecoMedio) : 0;

            return {
              ...p,
              updatedAt: new Date().toISOString(),
              data: {
                ...p.data,
                manualAssets: newManualAssets,
                total_live: newTotalLive,
                resumo: {
                  ...p.data.resumo,
                  total_investido: (p.data.resumo?.total_investido || 0) - deduction
                }
              }
            };
          }
          return p;
        });

        return {
          portfolios: updatedPortfolios,
          portfolio: updatePortfolioDerivedView(updatedPortfolios, state.activePortfolioId)
        };
      }),

      addAssetCategory: (category) => set((state) => ({
        assetCategories: Array.from(new Set([...state.assetCategories, category]))
      })),

      updatePortfolioPrices: (quotes) => set((state) => {
        const updateSection = (section: any[]) => section.map((asset) => {
          const quote = quotes.find((q) => q.symbol === asset.Ticker);
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

        const updatedPortfolios = state.portfolios.map((p) => {
          const newAcoes = updateSection(p.data.acoes || []);
          const newFiis = updateSection(p.data.fiis || []);
          const newManual = updateSection(p.data.manualAssets || []);
          
          const newTotalLive = [...newAcoes, ...newFiis, ...(p.data.tesouro || []), ...(p.data.renda_fixa || []), ...newManual]
            .reduce((acc, curr) => acc + (curr.Posicao || 0), 0);

          return {
            ...p,
            data: {
              ...p.data,
              acoes: newAcoes,
              fiis: newFiis,
              manualAssets: newManual,
              total_live: newTotalLive
            }
          };
        });

        const newCustomLists = state.customLists.map((list) => ({
          ...list,
          items: list.items.map((item: any) => {
            const quote = quotes.find((q) => q.symbol === item.ticker);
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
          portfolios: updatedPortfolios,
          customLists: newCustomLists,
          portfolio: updatePortfolioDerivedView(updatedPortfolios, state.activePortfolioId)
        };
      }),

      loadBackup: (data) => set(() => {
        let loadedPortfolios: Portfolio[] = [];
        if (data.portfolios && Array.isArray(data.portfolios) && data.portfolios.length > 0) {
          loadedPortfolios = data.portfolios;
        } else if (data.portfolio) {
          loadedPortfolios = [{
            id: 'default',
            name: 'Carteira Principal',
            color: '#6366f1',
            data: data.portfolio,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }];
        } else {
          loadedPortfolios = [{
            id: 'default',
            name: 'Carteira Principal',
            color: '#6366f1',
            data: createEmptyPortfolioData(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }];
        }

        const activeId = data.activePortfolioId || loadedPortfolios[0].id;

        return {
          portfolios: loadedPortfolios,
          activePortfolioId: activeId,
          portfolio: updatePortfolioDerivedView(loadedPortfolios, activeId),
          settings: data.settings || { estrategia: '', alvos: { fiis: 33.3, acoes: 33.3, renda_fixa: 33.4 } },
          snapshots: data.snapshots || [],
          customLists: data.customLists || [],
          equityHistory: data.equityHistory || [],
          monthlySnapshots: data.monthlySnapshots || [],
          monthlyPlan: data.monthlyPlan || { incomes: [], expenses: [], categories: ['Salário', 'Investimentos', 'Aluguel', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Outros'] },
          assetCategories: data.assetCategories || ['Ações', 'FIIs', 'Renda Fixa', 'Cripto', 'Exterior'],
          contributionAmount: data.contributionAmount || 1000,
          importConfig: data.importConfig || {
            sections: [
              { id: 'fiis', name: 'Fundos Imobiliários', trigger: 'Fundos Listados', type: 'fiis', mapping: { ticker: 0, position: 1, allocation: 2, price: 6, quantity: 7 } },
              { id: 'acoes', name: 'Ações', trigger: 'Renda Variável Brasil', type: 'acoes', mapping: { ticker: 0, position: 1, allocation: 2, price: 5, quantity: 6 } },
              { id: 'tesouro', name: 'Tesouro Direto', trigger: 'Tesouro Direto', type: 'tesouro', mapping: { ticker: 0, position: 1, allocation: 2, price: 3, quantity: 4 } },
              { id: 'renda_fixa', name: 'Renda Fixa', trigger: 'Renda Fixa', type: 'renda_fixa', mapping: { ticker: 0, position: 1, allocation: 2, price: 3, quantity: 8, extra: 7 } }
            ]
          },
          historicalTransactions: data.historicalTransactions || []
        };
      }),

      setMonthlyPlan: (monthlyPlan) => set({ monthlyPlan }),
      setContributionAmount: (amount: number) => set({ contributionAmount: amount }),
      setImportConfig: (importConfig) => set({ importConfig }),
      addMonthlySnapshot: (snapshot, resetExpenses) => set((state) => {
        const nextMonthlyPlan = resetExpenses
          ? { ...state.monthlyPlan, expenses: [] }
          : state.monthlyPlan;

        return {
          monthlySnapshots: [snapshot, ...state.monthlySnapshots],
          monthlyPlan: nextMonthlyPlan
        };
      }),

      deleteMonthlySnapshot: (id) => set((state) => ({
        monthlySnapshots: state.monthlySnapshots.filter((s) => s.id !== id)
      })),

      updateAsset: (type, identifier, updates, targetPortfolioId) => set((state) => {
        let pId = targetPortfolioId || state.activePortfolioId;
        const sectionMap: any = {
          acoes: 'acoes',
          fiis: 'fiis',
          tesouro: 'tesouro',
          renda_fixa: 'renda_fixa',
          manual: 'manualAssets'
        };
        const sectionKey = sectionMap[type] || type;

        const updatedPortfolios = state.portfolios.map((p) => {
          if (pId === 'all' || p.id === pId) {
            const section = (p.data as any)[sectionKey] || [];
            const hasMatch = section.some((a: any) => a.Ticker === identifier || a.id === identifier);
            if (!hasMatch && pId === 'all') return p;

            const newSection = section.map((a: any) =>
              a.Ticker === identifier || a.id === identifier ? { ...a, ...updates } : a
            );

            const newPortfolioData = { ...p.data, [sectionKey]: newSection };
            const all = [
              ...(newPortfolioData.acoes || []),
              ...(newPortfolioData.fiis || []),
              ...(newPortfolioData.tesouro || []),
              ...(newPortfolioData.renda_fixa || []),
              ...(newPortfolioData.manualAssets || [])
            ];
            const newTotalLive = all.reduce((acc: number, curr: any) => acc + (curr.Posicao || 0), 0);
            const newTotalInvested = all.reduce((acc: number, curr: any) => acc + ((curr.PrecoMedio || 0) * (curr.Quantidade || 0)), 0);

            return {
              ...p,
              updatedAt: new Date().toISOString(),
              data: {
                ...newPortfolioData,
                total_live: newTotalLive,
                resumo: {
                  ...newPortfolioData.resumo,
                  total_investido: newTotalInvested
                }
              }
            };
          }
          return p;
        });

        return {
          portfolios: updatedPortfolios,
          portfolio: updatePortfolioDerivedView(updatedPortfolios, state.activePortfolioId)
        };
      }),

      clearAllData: () => set({
        portfolios: [
          {
            id: 'default',
            name: 'Carteira Principal',
            color: '#6366f1',
            data: createEmptyPortfolioData(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        activePortfolioId: 'default',
        portfolio: createEmptyPortfolioData(),
        settings: { estrategia: '', alvos: { fiis: 33.3, acoes: 33.3, renda_fixa: 33.4 } },
        snapshots: [],
        customLists: [],
        equityHistory: [],
        monthlySnapshots: [],
        historicalTransactions: [],
        monthlyPlan: {
          incomes: [],
          expenses: [],
          categories: ['Salário', 'Investimentos', 'Aluguel', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Outros']
        },
        assetCategories: ['Ações', 'FIIs', 'Renda Fixa', 'Cripto', 'Exterior'],
        contributionAmount: 1000,
        importConfig: {
          sections: [
            { id: 'fiis', name: 'Fundos Imobiliários', trigger: 'Fundos Listados', type: 'fiis', mapping: { ticker: 0, position: 1, allocation: 2, price: 6, quantity: 7 } },
            { id: 'acoes', name: 'Ações', trigger: 'Renda Variável Brasil', type: 'acoes', mapping: { ticker: 0, position: 1, allocation: 2, price: 5, quantity: 6 } },
            { id: 'tesouro', name: 'Tesouro Direto', trigger: 'Tesouro Direto', type: 'tesouro', mapping: { ticker: 0, position: 1, allocation: 2, price: 3, quantity: 4 } },
            { id: 'renda_fixa', name: 'Renda Fixa', trigger: 'Renda Fixa', type: 'renda_fixa', mapping: { ticker: 0, position: 1, allocation: 2, price: 3, quantity: 8, extra: 7 } }
          ]
        }
      })
    }),
    {
      name: 'investment-storage',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Ensure portfolios list is initialized if coming from old storage
        if (!state.portfolios || !Array.isArray(state.portfolios) || state.portfolios.length === 0) {
          const legacyData = state.portfolio || createEmptyPortfolioData();
          state.portfolios = [
            {
              id: 'default',
              name: 'Carteira Principal',
              color: '#6366f1',
              data: legacyData,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ];
          state.activePortfolioId = 'default';
          state.portfolio = legacyData;
        } else {
          state.portfolio = updatePortfolioDerivedView(state.portfolios, state.activePortfolioId || 'default');
        }
      }
    }
  )
)
