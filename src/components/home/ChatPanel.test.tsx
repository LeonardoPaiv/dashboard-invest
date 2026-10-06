import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Proposal } from '../../chat/tools'
import { brl } from '../../lib/format'
import { DEFAULT_MODEL } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'
import { ChatPanel } from './ChatPanel'

const chat = () => useChatStore.getState()

const proposal = (overrides: Partial<Proposal> = {}): Proposal => ({
  id: 'prop-1',
  portfolioId: 'default',
  portfolioName: 'Carteira Principal',
  summary: 'Colunas mapeadas: Papel → Ticker.',
  operations: [{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 30, mode: 'add' }],
  rows: [{ label: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 30, mode: 'novo' }],
  status: 'pending',
  ...overrides,
})

beforeEach(() => {
  useChatStore.setState(useChatStore.getInitialState(), true)
  useInvestmentStore.getState().clearAllData()
  useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'valid', model: DEFAULT_MODEL })
})

describe('ChatPanel', () => {
  it.each(['missing', 'invalid'] as const)('asks for the key when the key is %s', (keyStatus) => {
    useAiSettingsStore.setState({ apiKey: keyStatus === 'missing' ? '' : 'old', keyStatus })
    render(<ChatPanel />)
    expect(screen.getByLabelText('Chave da API do OpenRouter')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Pergunte algo ou cole os dados da sua corretora…')).not.toBeInTheDocument()
  })

  it('shows the empty state with helper cards when the key is valid', () => {
    render(<ChatPanel />)
    expect(screen.getByText('Como posso ajudar?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Registrar compra/ })).toBeInTheDocument()
    expect(
      screen.getByText('Nada é salvo sem sua confirmação. Respostas podem conter erros — confira os valores.'),
    ).toBeInTheDocument()
  })

  it('fills the composer from the "Registrar compra" helper', async () => {
    render(<ChatPanel />)
    await userEvent.click(screen.getByRole('button', { name: /Registrar compra/ }))
    expect(screen.getByPlaceholderText('Pergunte algo ou cole os dados da sua corretora…')).toHaveValue(
      'Comprei 100 BBSE3 a 33,10',
    )
  })

  it('sends on Enter and keeps Shift+Enter for a new line', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    useChatStore.setState({ sendMessage })
    render(<ChatPanel />)
    const field = screen.getByPlaceholderText('Pergunte algo ou cole os dados da sua corretora…')
    await userEvent.type(field, 'linha 1{Shift>}{Enter}{/Shift}linha 2')
    expect(sendMessage).not.toHaveBeenCalled()
    await userEvent.type(field, '{Enter}')
    expect(sendMessage).toHaveBeenCalledWith('linha 1\nlinha 2')
  })

  it('disables sending when there is nothing to send', () => {
    render(<ChatPanel />)
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('stages an attached file and lets the user remove it', async () => {
    render(<ChatPanel />)
    const file = new File(['Ativo;Cotas\nTAEE11;80\n'], 'posicao.csv', { type: 'text/csv' })
    await userEvent.upload(screen.getByLabelText('Anexar planilha'), file)
    expect(chat().stagedFile).toBe(file)
    expect(screen.getByText('posicao.csv')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Remover anexo' }))
    expect(chat().stagedFile).toBeNull()
  })

  it('renders user and assistant messages, the attached file and the typing indicator', () => {
    useChatStore.setState({
      typing: true,
      messages: [
        { id: 'u1', role: 'user', text: 'Importa o extrato', file: { name: 'extrato.xlsx', meta: 'Planilha · 3 abas' } },
        { id: 'a1', role: 'assistant', text: 'Encontrei 4 posições.' },
      ],
    })
    render(<ChatPanel />)
    expect(screen.getAllByText('Importa o extrato').length).toBeGreaterThan(0)
    expect(screen.getByText('extrato.xlsx')).toBeInTheDocument()
    expect(screen.getByText('Planilha · 3 abas')).toBeInTheDocument()
    expect(screen.getByText('Encontrei 4 posições.')).toBeInTheDocument()
    expect(screen.getByText('Nemotron 3 Ultra está analisando…')).toBeInTheDocument()
    expect(screen.queryByText('Como posso ajudar?')).not.toBeInTheDocument()
  })

  it('shows a pending proposal and saves it on confirm', async () => {
    useChatStore.setState({ messages: [{ id: 'a1', role: 'assistant', text: 'Confira:', proposals: [proposal()] }] })
    render(<ChatPanel />)
    const card = screen.getByTestId('proposal-prop-1')
    expect(within(card).getByText('ITUB4')).toBeInTheDocument()
    expect(within(card).getByText('novo')).toBeInTheDocument()
    expect(within(card).getByText('Colunas mapeadas: Papel → Ticker.')).toBeInTheDocument()
    expect(within(card).getByText('→ Carteira Principal')).toBeInTheDocument()

    await userEvent.click(within(card).getByRole('button', { name: 'Confirmar' }))
    expect(useInvestmentStore.getState().portfolios[0].data.acoes[0]).toMatchObject({ Ticker: 'ITUB4', Quantidade: 10 })
    expect(within(card).getByText('Salvo em Carteira Principal')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  })

  it('dismisses a proposal without saving', async () => {
    useChatStore.setState({ messages: [{ id: 'a1', role: 'assistant', text: 'Confira:', proposals: [proposal()] }] })
    render(<ChatPanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.getByText('Descartado')).toBeInTheDocument()
    expect(useInvestmentStore.getState().portfolios[0].data.acoes).toEqual([])
  })

  it('shows why a proposal could not be saved', () => {
    useChatStore.setState({
      messages: [
        {
          id: 'a1',
          role: 'assistant',
          text: 'Confira:',
          proposals: [proposal({ status: 'failed', error: 'Operação 1 (remove_asset): O ativo ITUB4 não existe na carteira.' })],
        },
      ],
    })
    render(<ChatPanel />)
    expect(screen.getByText(/Não foi salvo/)).toHaveTextContent('O ativo ITUB4 não existe na carteira.')
  })

  it('starts a new conversation', async () => {
    useChatStore.setState({ messages: [{ id: 'a1', role: 'assistant', text: 'Olá' }] })
    render(<ChatPanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
    expect(chat().messages).toEqual([])
  })

  it('shows a settings proposal as before → after rows and applies it on confirm', async () => {
    useChatStore.setState({
      messages: [{
        id: 'a1', role: 'assistant', text: 'Confira:',
        proposals: [{
          id: 'set-1', portfolioId: '', portfolioName: 'Estratégia', summary: 'Aporte maior.', operations: [], rows: [],
          status: 'pending', page: 'strategy',
          settings: {
            operations: [{ type: 'set_contribution', amount: 2500 }],
            rows: [{ label: 'Aporte', before: brl(1000), after: brl(2500), mode: 'alterar' }],
          },
        }],
      }],
    })
    render(<ChatPanel />)
    const card = screen.getByTestId('proposal-set-1')
    expect(within(card).getByText('→ Estratégia')).toBeInTheDocument()
    expect(within(card).getByText('Aporte')).toBeInTheDocument()
    expect(within(card).getByText((_, el) => el?.textContent === brl(1000))).toBeInTheDocument()
    expect(within(card).getByText((_, el) => el?.textContent === brl(2500))).toBeInTheDocument()
    expect(within(card).getByText('alterar')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Confirmar' }))
    expect(useInvestmentStore.getState().contributionAmount).toBe(2500)
    expect(within(card).getByText('Salvo em Estratégia')).toBeInTheDocument()
  })
  it('shows the open conversation title and the conversations button', () => {
    useChatStore.setState({
      conversationId: 'c1',
      conversations: [{ id: 'c1', title: 'Metas 40/40/20', page: 'strategy', createdAt: '2026-01-01', updatedAt: '2026-01-01', messages: [], history: [] }],
    })
    render(<ChatPanel />)
    expect(screen.getByText('Metas 40/40/20')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conversas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fechar assistente' })).not.toBeInTheDocument()
  })

  it('offers "Visualizar página" apart from confirming, only when the data lives on another page', async () => {
    const settings = {
      id: 'set-1', portfolioId: '', portfolioName: 'Estratégia', summary: '', operations: [], rows: [],
      status: 'pending' as const, page: 'strategy' as const,
      settings: { operations: [{ type: 'set_contribution' as const, amount: 2500 }], rows: [] },
    }
    useChatStore.setState({
      messages: [{ id: 'a1', role: 'assistant', text: 'Confira:', proposals: [settings, proposal({ page: 'dashboard' })] }],
    })
    render(<ChatPanel />)
    expect(within(screen.getByTestId('proposal-prop-1')).queryByRole('button', { name: /Visualizar página/ })).not.toBeInTheDocument()
    const card = screen.getByTestId('proposal-set-1')
    await userEvent.click(within(card).getByRole('button', { name: 'Confirmar' }))
    expect(useInvestmentStore.getState().activeTab).toBe('dashboard')
    await userEvent.click(within(card).getByRole('button', { name: /Visualizar página/ }))
    expect(useInvestmentStore.getState().activeTab).toBe('strategy')
    expect(within(card).queryByRole('button', { name: /Visualizar página/ })).not.toBeInTheDocument()
  })
})
