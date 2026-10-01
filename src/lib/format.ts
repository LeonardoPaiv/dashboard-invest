export const brl = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

export const pct = (value: number): string => (value || 0).toFixed(1).replace('.', ',') + '%'

export const num = (value: number): string =>
  Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
