import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_MODEL } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'
import { FloatingChat } from './FloatingChat'

const chat = () => useChatStore.getState()
const saved = (id: string, title: string, page: 'financiamento' | 'history', updatedAt: string) => ({
  id, title, page, createdAt: updatedAt, updatedAt,
  messages: [{ id: `${id}-u`, role: 'user' as const, text: title }],
  history: [{ role: 'user' as const, content: title }],
})

beforeEach(() => {
  useChatStore.setState(useChatStore.getInitialState(), true)
  useInvestmentStore.getState().clearAllData()
  useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'valid', model: DEFAULT_MODEL })
})

describe('FloatingChat', () => {
  it('renders nothing on the dashboard, where the chat is docked', () => {
    useInvestmentStore.getState().setActiveTab('dashboard')
    const { container } = render(<FloatingChat />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a launcher on other pages and opens the conversation relevant to that page', async () => {
    useInvestmentStore.getState().setActiveTab('financiamento')
    useChatStore.setState({
      conversations: [saved('c1', 'Prazo de 300 meses', 'financiamento', '2026-01-02'), saved('c2', 'Fechamentos', 'history', '2026-01-03')],
    })
    render(<FloatingChat />)
    expect(screen.queryByPlaceholderText('Pergunte algo ou cole os dados da sua corretora…')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir assistente' }))
    expect(chat()).toMatchObject({ panelOpen: true, conversationId: 'c1' })
    expect(screen.getByPlaceholderText('Pergunte algo ou cole os dados da sua corretora…')).toBeInTheDocument()
    expect(screen.getAllByText('Prazo de 300 meses').length).toBeGreaterThan(0)
  })

  it('closes back to the launcher', async () => {
    useInvestmentStore.getState().setActiveTab('history')
    useChatStore.setState({ panelOpen: true })
    render(<FloatingChat />)
    await userEvent.click(screen.getByRole('button', { name: 'Fechar assistente' }))
    expect(chat().panelOpen).toBe(false)
    expect(screen.getByRole('button', { name: 'Abrir assistente' })).toBeInTheDocument()
  })

  it('lists saved conversations, switches between them and deletes one', async () => {
    useInvestmentStore.getState().setActiveTab('history')
    useChatStore.setState({
      panelOpen: true,
      conversations: [saved('c2', 'Fechamentos', 'history', '2026-01-03'), saved('c1', 'Prazo de 300 meses', 'financiamento', '2026-01-02')],
    })
    render(<FloatingChat />)
    await userEvent.click(screen.getByRole('button', { name: 'Conversas' }))
    const menu = screen.getByRole('menu', { name: 'Conversas salvas' })
    expect(within(menu).getByText('Financiamento')).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Prazo de 300 meses/ }))
    expect(chat().conversationId).toBe('c1')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Conversas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Apagar conversa Fechamentos' }))
    expect(chat().conversations.map((c) => c.id)).toEqual(['c1'])
  })

  it('says so when there is no saved conversation', async () => {
    useInvestmentStore.getState().setActiveTab('history')
    useChatStore.setState({ panelOpen: true })
    render(<FloatingChat />)
    await userEvent.click(screen.getByRole('button', { name: 'Conversas' }))
    expect(screen.getByText('Nenhuma conversa salva ainda.')).toBeInTheDocument()
  })
})
