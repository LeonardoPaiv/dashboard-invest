export const PAGES = [
  { id: 'dashboard', label: 'Dashboard', about: 'carteira, ativos, categorias e gráfico de alocação' },
  { id: 'strategy', label: 'Estratégia', about: 'metas de alocação, texto da estratégia, valor do aporte e rebalanceamento' },
  { id: 'projection', label: 'Projeção', about: 'simulação de juros compostos (aporte mensal, taxa anual, anos)' },
  { id: 'plano-mensal', label: 'Plano Mensal', about: 'receitas, despesas e categorias do orçamento mensal' },
  { id: 'preco-medio', label: 'Preço Médio', about: 'cálculo de preço médio a partir das negociações da B3' },
  { id: 'imposto-renda', label: 'Imposto de Renda', about: 'apoio à declaração com base nas negociações importadas' },
  { id: 'financiamento', label: 'Financiamento', about: 'simulador de financiamento imobiliário e amortizações extras' },
  { id: 'history', label: 'Histórico', about: 'fechamentos mensais salvos do plano mensal' },
  { id: 'data-management', label: 'Menu de Dados', about: 'backup, restauração e limpeza dos dados locais' },
] as const

export type PageId = (typeof PAGES)[number]['id']

export const isPageId = (value: unknown): value is PageId => PAGES.some((page) => page.id === value)

export const pageLabel = (id: string): string => PAGES.find((page) => page.id === id)?.label ?? id
