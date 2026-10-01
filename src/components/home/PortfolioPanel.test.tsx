import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchQuotes } from '../../services/brapi'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'
import { PortfolioPanel } from './PortfolioPanel'

vi.mock('../../services/brapi', () => ({ fetchQuotes: vi.fn() }))

const quotes = vi.mocked(fetchQuotes)
const invest = () => useInvestmentStore.getState()

const seed = () =>
  invest().applyAssetOperations('default', [
    { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 60, mode: 'add' },
    { type: 'upsert_asset', ticker: 'WEGE3', category: 'Ações', quantity: 10, avgPrice: 20, mode: 'add' },
    { type: 'upsert_asset', ticker: 'HGLG11', category: 'FIIs', quantity: 10, avgPrice: 20, mode: 'add' },
  ])

beforeEach(() => {
  quotes.mockReset()
  quotes.mockResolvedValue([])
  useChatStore.setState(useChatStore.getInitialState(), true)
  invest().clearAllData()
})

describe('PortfolioPanel', () => {
  it('invites the user to the chat when the portfolio is empty', () => {
    render(<PortfolioPanel />)
    expect(screen.getByText('Nenhum ativo ainda')).toBeInTheDocument()
  })

  it('shows category pills with their share and every asset sorted by value', () => {
    seed()
    render(<PortfolioPanel />)
    expect(screen.getByTestId('pill-Ações')).toHaveTextContent('80,0%')
    expect(screen.getByTestId('pill-FIIs')).toHaveTextContent('20,0%')
    expect(screen.getAllByTestId('asset-row').map((row) => within(row).getByTestId('asset-ticker').textContent)).toEqual([
      'ITUB4',
      'WEGE3',
      'HGLG11',
    ])
    expect(screen.getByText('3 ativos')).toBeInTheDocument()
    expect(screen.getByText('% da carteira por categoria')).toBeInTheDocument()
  })

  it('filters by category from a pill and recomputes allocation inside it', async () => {
    seed()
    render(<PortfolioPanel />)
    await userEvent.click(screen.getByTestId('pill-Ações'))
    const rows = screen.getAllByTestId('asset-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('75,0%')
    expect(screen.getByText('% dentro de Ações')).toBeInTheDocument()
    expect(screen.getByText('Aloc. cat.')).toBeInTheDocument()
  })

  it('filters by category from the chart legend', async () => {
    seed()
    render(<PortfolioPanel />)
    await userEvent.click(screen.getByTestId('legend-FIIs'))
    expect(screen.getAllByTestId('asset-row')).toHaveLength(1)
  })

  it('sends "Adicionar" to the chat composer', async () => {
    seed()
    render(<PortfolioPanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(useChatStore.getState()).toMatchObject({ draft: 'Comprei ', composeRequest: 1 })
  })

  it('refreshes quotes for stocks and funds and applies them', async () => {
    seed()
    quotes.mockResolvedValue([
      { symbol: 'ITUB4', shortName: 'Itaú', regularMarketPrice: 70, regularMarketChangePercent: 0, logourl: '', sector: 'Bancos' },
    ])
    render(<PortfolioPanel />)
    await waitFor(() => expect(invest().portfolios[0].data.acoes[0].Cotacao).toBe(70))
    expect(quotes.mock.calls[0][0].sort()).toEqual(['HGLG11', 'ITUB4', 'WEGE3'])
  })

  it('does not ask for quotes when there is nothing quotable', () => {
    render(<PortfolioPanel />)
    expect(quotes).not.toHaveBeenCalled()
  })

  it('renders one row per portfolio when a ticker is held in two portfolios, without key warnings', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    invest().applyAssetOperations('default', [
      { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 60, mode: 'add' },
    ])
    const other = invest().addPortfolio('Aposentadoria')
    invest().applyAssetOperations(other, [
      { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 5, avgPrice: 60, mode: 'add' },
    ])
    invest().setActivePortfolio('all')
    render(<PortfolioPanel />)
    const rows = screen.getAllByTestId('asset-row')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toHaveTextContent('Aposentadoria')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('runs one more refresh when the ticker set changes while a fetch is in flight', async () => {
    seed()
    let release: (value: never[]) => void = () => {}
    quotes.mockReset()
    quotes.mockImplementationOnce(() => new Promise((resolve) => { release = resolve as any }))
    quotes.mockResolvedValue([])
    render(<PortfolioPanel />)
    await waitFor(() => expect(quotes).toHaveBeenCalledTimes(1))
    act(() => {
      invest().applyAssetOperations('default', [
        { type: 'upsert_asset', ticker: 'PETR4', category: 'Ações', quantity: 1, avgPrice: 30, mode: 'add' },
      ])
    })
    expect(quotes).toHaveBeenCalledTimes(1)
    await act(async () => { release([]) })
    await waitFor(() => expect(quotes).toHaveBeenCalledTimes(2))
    expect(quotes.mock.calls[1][0]).toContain('PETR4')
  })
})
