import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runAgentTurn } from '../chat/agent'
import { prepareAttachment } from '../chat/attachments'
import type { Proposal } from '../chat/tools'
import { OpenRouterError } from '../lib/openrouter/client'
import { DEFAULT_MODEL } from '../lib/openrouter/models'
import { useAiSettingsStore } from './useAiSettingsStore'
import { buildToolContext, useChatStore } from './useChatStore'
import { useFinancingStore } from './useFinancingStore'
import { useInvestmentStore } from './useInvestmentStore'

vi.mock('../chat/agent', () => ({ runAgentTurn: vi.fn() }))
vi.mock('../chat/attachments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../chat/attachments')>()
  return { ...actual, prepareAttachment: vi.fn(actual.prepareAttachment) }
})

const runTurn = vi.mocked(runAgentTurn)
const prepare = vi.mocked(prepareAttachment)
type Prepared = Awaited<ReturnType<typeof prepareAttachment>>
const deferredAttachment = () => {
  let resolve: (value: Prepared) => void = () => {}
  prepare.mockImplementationOnce(() => new Promise<Prepared>((r) => (resolve = r)))
  return (value: Prepared) => resolve(value)
}
const prepared: Prepared = { name: 'posicao.csv', meta: 'CSV · 2 linhas', promptText: 'Arquivo anexado: posicao.csv' }
const chat = () => useChatStore.getState()
const invest = () => useInvestmentStore.getState()

const proposal = (overrides: Partial<Proposal> = {}): Proposal => ({
  id: 'prop-1',
  portfolioId: 'default',
  portfolioName: 'Carteira Principal',
  summary: 'Compra',
  operations: [{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 30, mode: 'add' }],
  rows: [{ label: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 30, mode: 'novo' }],
  status: 'pending',
  ...overrides,
})

const seedProposal = (p: Proposal) =>
  useChatStore.setState({ messages: [{ id: 'm1', role: 'assistant', text: 'Prévia', proposals: [p] }] })

beforeEach(() => {
  runTurn.mockReset()
  useChatStore.setState(useChatStore.getInitialState(), true)
  invest().clearAllData()
  useFinancingStore.getState().resetToDefaults()
  invest().setActiveTab('dashboard')
  useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'valid', model: DEFAULT_MODEL })
})

describe('sendMessage', () => {
  it('appends the user message and the assistant reply and stores the API history', async () => {
    const history = [
      { role: 'user' as const, content: 'oi' },
      { role: 'assistant' as const, content: 'Olá!' },
    ]
    runTurn.mockResolvedValue({ history, reply: 'Olá!', proposals: [] })
    chat().setDraft('oi')
    await chat().sendMessage('  oi  ')

    expect(chat().messages.map((m) => [m.role, m.text])).toEqual([
      ['user', 'oi'],
      ['assistant', 'Olá!'],
    ])
    expect(chat()).toMatchObject({ history, typing: false, draft: '' })
    expect(runTurn).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-or-abc', model: DEFAULT_MODEL, history: [], userContent: 'oi' }),
    )
  })

  it('attaches proposals to the assistant message', async () => {
    runTurn.mockResolvedValue({ history: [], reply: 'Prévia pronta.', proposals: [proposal()] })
    await chat().sendMessage('Comprei 10 ITUB4 a 30')
    expect(chat().messages[1].proposals).toEqual([proposal()])
  })

  it('ignores empty messages and messages sent while a reply is pending', async () => {
    await chat().sendMessage('   ')
    useChatStore.setState({ typing: true })
    await chat().sendMessage('oi')
    expect(runTurn).not.toHaveBeenCalled()
    expect(chat().messages).toEqual([])
  })

  it('shows the typing state while waiting', async () => {
    let resolve: (value: Awaited<ReturnType<typeof runAgentTurn>>) => void = () => {}
    runTurn.mockReturnValue(new Promise((r) => (resolve = r)))
    const pending = chat().sendMessage('oi')
    expect(chat().typing).toBe(true)
    resolve({ history: [], reply: 'ok', proposals: [] })
    await pending
    expect(chat().typing).toBe(false)
  })

  it('on 401 marks the key invalid, removes the unsent message and restores the draft', async () => {
    runTurn.mockRejectedValue(new OpenRouterError('Invalid credentials', 401))
    await chat().sendMessage('Comprei 10 ITUB4 a 30')
    expect(useAiSettingsStore.getState().keyStatus).toBe('invalid')
    expect(chat().messages).toEqual([])
    expect(chat()).toMatchObject({ draft: 'Comprei 10 ITUB4 a 30', typing: false })
  })

  it('on 401 also restores the staged file', async () => {
    const file = new File(['Ativo;Cotas\nTAEE11;80\n'], 'posicao.csv')
    runTurn.mockRejectedValue(new OpenRouterError('Invalid credentials', 401))
    chat().stageFile(file)
    await chat().sendMessage('importa')
    expect(chat().stagedFile).toBe(file)
  })

  it.each([
    [new OpenRouterError('Insufficient credits', 402), 'Sua conta do OpenRouter está sem créditos para este modelo.'],
    [new OpenRouterError('Rate limited', 429), 'Limite de requisições do OpenRouter atingido. Aguarde um pouco e tente de novo.'],
    [new OpenRouterError('Model not found', 404), 'Erro do OpenRouter: Model not found'],
    [new TypeError('Failed to fetch'), 'Não consegui falar com o OpenRouter. Verifique sua conexão e tente de novo.'],
  ])('shows a readable error and keeps the key for other failures', async (error, expected) => {
    runTurn.mockRejectedValue(error)
    await chat().sendMessage('oi')
    expect(chat().messages[1]).toMatchObject({ role: 'assistant', text: expected, isError: true })
    expect(useAiSettingsStore.getState().keyStatus).toBe('valid')
    expect(chat().history).toEqual([])
  })

  it('sends the attachment content to the model and shows the file on the user message', async () => {
    runTurn.mockResolvedValue({ history: [], reply: 'ok', proposals: [] })
    chat().stageFile(new File(['Ativo;Cotas\nTAEE11;80\n'], 'posicao.csv'))
    await chat().sendMessage('')
    expect(chat().messages[0]).toMatchObject({
      text: 'Importe as posições deste arquivo.',
      file: { name: 'posicao.csv', meta: 'CSV · 2 linhas' },
    })
    expect(chat().stagedFile).toBeNull()
    const { userContent } = runTurn.mock.calls[0][0]
    expect(userContent).toContain('Importe as posições deste arquivo.')
    expect(userContent).toContain('Arquivo anexado: posicao.csv')
    expect(userContent).toContain('TAEE11 | 80')
  })

  it('reports an unreadable attachment without calling the model', async () => {
    chat().stageFile(new File(['x'], 'nota.pdf'))
    await chat().sendMessage('importa')
    expect(runTurn).not.toHaveBeenCalled()
    expect(chat().messages).toHaveLength(1)
    expect(chat().messages[0]).toMatchObject({ role: 'assistant', isError: true })
    expect(chat().messages[0].text).toContain('Formato não suportado')
    expect(chat().stagedFile).toBeNull()
  })

  it('drops a reply that arrives after "Nova conversa"', async () => {
    let resolve: (value: Awaited<ReturnType<typeof runAgentTurn>>) => void = () => {}
    runTurn.mockReturnValue(new Promise((r) => (resolve = r)))
    const pending = chat().sendMessage('oi')
    chat().newChat()
    resolve({ history: [{ role: 'user', content: 'oi' }], reply: 'tarde demais', proposals: [] })
    await pending
    expect(chat()).toMatchObject({ messages: [], history: [], typing: false })
  })
})

describe('sendMessage async ordering', () => {
  const csv = () => new File(['Ativo;Cotas\nTAEE11;80\n'], 'posicao.csv')

  it('is typing immediately when a staged file is being read', async () => {
    const finish = deferredAttachment()
    runTurn.mockResolvedValue({ history: [], reply: 'ok', proposals: [] })
    chat().stageFile(csv())
    const pending = chat().sendMessage('importa')
    expect(chat().typing).toBe(true)
    finish(prepared)
    await pending
    expect(chat().typing).toBe(false)
  })

  it('ignores a second send while the attachment is being read', async () => {
    const finish = deferredAttachment()
    runTurn.mockResolvedValue({ history: [], reply: 'ok', proposals: [] })
    chat().stageFile(csv())
    const first = chat().sendMessage('importa')
    const second = chat().sendMessage('importa')
    finish(prepared)
    await Promise.all([first, second])
    expect(runTurn).toHaveBeenCalledTimes(1)
    expect(chat().messages.filter((m) => m.role === 'user')).toHaveLength(1)
  })

  it('drops an attachment read that finishes after "Nova conversa" and leaves the chat usable', async () => {
    const finish = deferredAttachment()
    chat().stageFile(csv())
    const pending = chat().sendMessage('importa')
    chat().newChat()
    finish(prepared)
    await pending
    expect(runTurn).not.toHaveBeenCalled()
    expect(chat()).toMatchObject({ messages: [], typing: false })

    runTurn.mockResolvedValue({ history: [], reply: 'ok', proposals: [] })
    await chat().sendMessage('oi')
    expect(chat().messages.map((m) => m.text)).toEqual(['oi', 'ok'])
  })

  it('keeps notes added while a reply is pending', async () => {
    let resolve: (value: Awaited<ReturnType<typeof runAgentTurn>>) => void = () => {}
    runTurn.mockReturnValue(new Promise((r) => (resolve = r)))
    seedProposal(proposal())
    const pending = chat().sendMessage('oi')
    chat().confirmProposal('m1', 'prop-1')
    const resultHistory = [
      { role: 'user' as const, content: 'oi' },
      { role: 'assistant' as const, content: 'ok' },
    ]
    resolve({ history: resultHistory, reply: 'ok', proposals: [] })
    await pending
    expect(chat().history).toEqual([
      ...resultHistory,
      { role: 'user', content: '(nota automática do app) O usuário confirmou a proposta prop-1; as alterações foram salvas.' },
    ])
  })
})

describe('buildToolContext', () => {
  it('targets the active portfolio', () => {
    expect(buildToolContext()).toMatchObject({ targetPortfolioId: 'default', viewLabel: 'Carteira Principal' })
  })

  it('targets the first portfolio and labels the view when showing all portfolios', () => {
    invest().addPortfolio('Aposentadoria')
    invest().setActivePortfolio('all')
    const context = buildToolContext()
    expect(context.targetPortfolioId).toBe('default')
    expect(context.viewLabel).toBe('Todas as carteiras (consolidado)')
    expect(context.workspace.categories).toEqual(expect.arrayContaining(['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto']))
  })
})

describe('buildToolContext — navigation', () => {
  it('reports the current page and navigates through the store', () => {
    invest().setActiveTab('history')
    const ctx = buildToolContext()
    expect(ctx.currentPage).toBe('history')
    ctx.navigate('financiamento')
    expect(invest().activeTab).toBe('financiamento')
    ctx.selectPortfolio('all')
    expect(invest().activePortfolioId).toBe('all')
  })
})

describe('confirmProposal', () => {
  it('keeps the view on confirm and shows the target portfolio when the user asks to view it', () => {
    invest().addPortfolio('Aposentadoria')
    const other = invest().portfolios.find((p) => p.name === 'Aposentadoria')!.id
    invest().setActivePortfolio('default')
    seedProposal(proposal({ portfolioId: other, portfolioName: 'Aposentadoria', page: 'dashboard' }))
    chat().confirmProposal('m1', 'prop-1')
    expect(invest().activePortfolioId).toBe('default')
    chat().viewProposal('m1', 'prop-1')
    expect(invest().activePortfolioId).toBe(other)
  })

  it('leaves the consolidated view alone after confirming an asset proposal', () => {
    invest().setActivePortfolio('all')
    seedProposal(proposal({ page: 'dashboard' }))
    chat().confirmProposal('m1', 'prop-1')
    expect(invest().activePortfolioId).toBe('all')
  })

  it('applies the operations, marks the proposal done and tells the user and the model', () => {
    seedProposal(proposal())
    chat().confirmProposal('m1', 'prop-1')

    expect(invest().portfolios[0].data.acoes[0]).toMatchObject({ Ticker: 'ITUB4', Quantidade: 10 })
    expect(chat().messages[0].proposals?.[0].status).toBe('done')
    expect(chat().messages[1]).toMatchObject({
      role: 'assistant',
      text: 'Pronto — 1 alteração salva em Carteira Principal. O gráfico e a lista já refletem a mudança.',
    })
    expect(chat().history).toEqual([
      { role: 'user', content: '(nota automática do app) O usuário confirmou a proposta prop-1; as alterações foram salvas.' },
    ])
  })

  it('does not apply the same proposal twice', () => {
    seedProposal(proposal())
    chat().confirmProposal('m1', 'prop-1')
    chat().confirmProposal('m1', 'prop-1')
    expect(invest().portfolios[0].data.acoes[0].Quantidade).toBe(10)
    expect(chat().messages).toHaveLength(2)
  })

  it('marks the proposal as failed and saves nothing when the data changed since the preview', () => {
    seedProposal(proposal({ operations: [{ type: 'remove_asset', ticker: 'ITUB4' }] }))
    const before = invest().portfolios
    chat().confirmProposal('m1', 'prop-1')
    const failed = chat().messages[0].proposals?.[0]
    expect(failed?.status).toBe('failed')
    expect(failed?.error).toContain('ITUB4')
    expect(invest().portfolios).toBe(before)
  })

  it('fails cleanly when the target portfolio was deleted', () => {
    seedProposal(proposal({ portfolioId: 'gone' }))
    chat().confirmProposal('m1', 'prop-1')
    expect(chat().messages[0].proposals?.[0]).toMatchObject({ status: 'failed' })
    expect(chat().messages[0].proposals?.[0].error).toContain('Carteira de destino não encontrada')
  })
})

describe('dismissProposal', () => {
  it('marks the proposal dismissed without saving', () => {
    seedProposal(proposal())
    chat().dismissProposal('m1', 'prop-1')
    expect(chat().messages[0].proposals?.[0].status).toBe('dismissed')
    expect(invest().portfolios[0].data.acoes).toEqual([])
    expect(chat().history).toEqual([
      { role: 'user', content: '(nota automática do app) O usuário descartou a proposta prop-1; nada foi salvo.' },
    ])
  })
})

describe('compose helpers', () => {
  it('fills the draft and asks for focus', () => {
    chat().requestCompose('Comprei ')
    expect(chat()).toMatchObject({ draft: 'Comprei ', composeRequest: 1 })
  })

  it('clears the conversation on newChat but keeps the draft', () => {
    useChatStore.setState({
      messages: [{ id: 'a', role: 'user', text: 'x' }],
      history: [{ role: 'user', content: 'x' }],
      draft: 'rascunho',
    })
    chat().newChat()
    expect(chat()).toMatchObject({ messages: [], history: [], typing: false, draft: 'rascunho' })
  })
})

const settingsProposal = (overrides: Partial<Proposal> = {}): Proposal => ({
  id: 'set-1', portfolioId: '', portfolioName: 'Financiamento', summary: 'Prazo', operations: [], rows: [],
  status: 'pending', page: 'financiamento',
  settings: {
    operations: [{ type: 'update_financing', params: { termMonths: 300 } }],
    rows: [{ label: 'Prazo (meses)', before: '360', after: '300', mode: 'alterar' }],
  },
  ...overrides,
})

describe('confirmProposal — settings', () => {
  it('applies the settings and reports it without leaving the current page', () => {
    seedProposal(settingsProposal())
    chat().confirmProposal('m1', 'set-1')
    expect(useFinancingStore.getState().params.termMonths).toBe(300)
    expect(chat().messages[0].proposals?.[0].status).toBe('done')
    expect(chat().messages[1].text).toBe('Pronto — 1 alteração salva em Financiamento.')
    expect(invest().activeTab).toBe('dashboard')
  })
  it('opens the owning page only when the user asks to view it', () => {
    seedProposal(settingsProposal())
    chat().viewProposal('m1', 'set-1')
    expect(invest().activeTab).toBe('financiamento')
    expect(chat().panelOpen).toBe(true)
    expect(useFinancingStore.getState().params.termMonths).toBe(360)
    expect(chat().messages[0].proposals?.[0].status).toBe('pending')
  })
  it('revalidates against the current data and saves nothing when it no longer applies', () => {
    seedProposal(settingsProposal({
      page: 'plano-mensal', portfolioName: 'Plano Mensal',
      settings: { operations: [{ type: 'remove_monthly_item', kind: 'expense', name: 'Aluguel' }], rows: [] },
    }))
    chat().confirmProposal('m1', 'set-1')
    expect(chat().messages[0].proposals?.[0]).toMatchObject({
      status: 'failed',
      error: 'Operação 1 (remove_monthly_item): Não existe despesa chamada "Aluguel".',
    })
    expect(invest().activeTab).toBe('dashboard')
  })
  it('stays on the current page after confirming an asset proposal and opens the dashboard on view', () => {
    invest().setActiveTab('history')
    seedProposal(proposal({ page: 'dashboard' }))
    chat().confirmProposal('m1', 'prop-1')
    expect(invest().activeTab).toBe('history')
    chat().viewProposal('m1', 'prop-1')
    expect(invest().activeTab).toBe('dashboard')
  })
})

describe('saved conversations', () => {
  const reply = (text: string) => runTurn.mockResolvedValueOnce({ history: [{ role: 'user', content: 'x' }, { role: 'assistant', content: text }], reply: text, proposals: [] })

  it('saves the conversation as it grows, titled and tagged with the current page', async () => {
    invest().setActiveTab('financiamento')
    reply('Feito.')
    await chat().sendMessage('Mude o prazo para 300 meses')
    expect(chat().conversations).toHaveLength(1)
    expect(chat().conversations[0]).toMatchObject({ id: chat().conversationId, title: 'Mude o prazo para 300 meses', page: 'financiamento' })
    expect(chat().conversations[0].messages).toHaveLength(2)
    reply('Mais uma.')
    await chat().sendMessage('E a entrada?')
    expect(chat().conversations).toHaveLength(1)
    expect(chat().conversations[0].messages).toHaveLength(4)
  })

  it('writes conversations to localStorage and does not save an empty chat', async () => {
    chat().newChat()
    expect(chat().conversations).toEqual([])
    reply('Olá!')
    await chat().sendMessage('oi')
    const stored = JSON.parse(localStorage.getItem('chat-conversations')!).state
    expect(stored.conversations[0].title).toBe('oi')
    expect(stored.conversationId).toBe(chat().conversationId)
    expect(stored.typing).toBeUndefined()
  })

  it('starts a new chat without losing the saved one, and reopens it', async () => {
    reply('Olá!')
    await chat().sendMessage('primeira')
    const firstId = chat().conversationId!
    chat().newChat()
    expect(chat()).toMatchObject({ messages: [], history: [], conversationId: null })
    reply('Oi de novo')
    await chat().sendMessage('segunda')
    expect(chat().conversations.map((c) => c.title)).toEqual(['segunda', 'primeira'])
    chat().openConversation(firstId)
    expect(chat().conversationId).toBe(firstId)
    expect(chat().messages.map((m) => m.text)).toEqual(['primeira', 'Olá!'])
    // reabrir não mexe na ordem nem na data
    expect(chat().conversations.map((c) => c.title)).toEqual(['segunda', 'primeira'])
  })

  it('opens the most recent conversation of the page, or a blank one', async () => {
    invest().setActiveTab('financiamento')
    reply('ok')
    await chat().sendMessage('sobre financiamento')
    const financingId = chat().conversationId
    invest().setActiveTab('plano-mensal')
    chat().openRelevant('plano-mensal')
    expect(chat()).toMatchObject({ messages: [], conversationId: null })
    chat().openRelevant('financiamento')
    expect(chat().conversationId).toBe(financingId)
    chat().openRelevant('financiamento')
    expect(chat().conversationId).toBe(financingId)
  })

  it('does not switch conversations from the launcher while a reply is pending', () => {
    useChatStore.setState({ typing: true, messages: [{ id: 'u', role: 'user', text: 'oi' }] })
    const before = chat().conversationId
    chat().openRelevant('history')
    expect(chat().conversationId).toBe(before)
    expect(chat().messages).toHaveLength(1)
  })

  it('drops a late reply when the user switched conversations meanwhile', async () => {
    reply('Olá!')
    await chat().sendMessage('primeira')
    const firstId = chat().conversationId!
    chat().newChat()
    let resolve: (value: Awaited<ReturnType<typeof runAgentTurn>>) => void = () => {}
    runTurn.mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    const pending = chat().sendMessage('segunda')
    await Promise.resolve()
    chat().openConversation(firstId)
    resolve({ history: [], reply: 'atrasada', proposals: [] })
    await pending
    expect(chat().messages.map((m) => m.text)).toEqual(['primeira', 'Olá!'])
    expect(chat().typing).toBe(false)
  })

  it('does not navigate from a turn the user already walked away from', async () => {
    let toolContext: () => ReturnType<typeof buildToolContext> = buildToolContext
    let resolve: (value: Awaited<ReturnType<typeof runAgentTurn>>) => void = () => {}
    runTurn.mockImplementationOnce((options) => {
      toolContext = options.toolContext as () => ReturnType<typeof buildToolContext>
      return new Promise((r) => (resolve = r))
    })
    const pending = chat().sendMessage('oi')
    await Promise.resolve()
    chat().newChat()
    toolContext().navigate('financiamento')
    toolContext().selectPortfolio('all')
    resolve({ history: [], reply: 'atrasada', proposals: [] })
    await pending
    expect(invest().activeTab).toBe('dashboard')
    expect(invest().activePortfolioId).toBe('default')
    expect(chat().panelOpen).toBe(false)
  })

  it('updates the conversation page to where it was last used', async () => {
    invest().setActiveTab('financiamento')
    reply('ok')
    await chat().sendMessage('oi')
    expect(chat().conversations[0].page).toBe('financiamento')
    invest().setActiveTab('strategy')
    reply('ok de novo')
    await chat().sendMessage('e agora')
    expect(chat().conversations[0].page).toBe('strategy')
    chat().openRelevant('strategy')
    expect(chat().messages.map((m) => m.text)).toEqual(['oi', 'ok', 'e agora', 'ok de novo'])
  })

  it('deletes a conversation and clears the screen when it was the open one', async () => {
    reply('Olá!')
    await chat().sendMessage('primeira')
    chat().deleteConversation(chat().conversationId!)
    expect(chat()).toMatchObject({ conversations: [], messages: [], conversationId: null })
  })

  it('moves the open conversation to the page the app navigated to', async () => {
    reply('ok')
    await chat().sendMessage('oi')
    chat().goTo('strategy')
    expect(chat().conversations[0].page).toBe('strategy')
  })

  it('keeps chatting when localStorage refuses to save', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    reply('Olá!')
    await chat().sendMessage('oi')
    expect(chat().messages.map((m) => m.text)).toEqual(['oi', 'Olá!'])
    setItem.mockRestore()
  })

  it('clears every saved conversation', async () => {
    reply('Olá!')
    await chat().sendMessage('oi')
    chat().clearConversations()
    expect(chat()).toMatchObject({ conversations: [], messages: [], history: [], conversationId: null })
  })
})

describe('floating panel', () => {
  it('opens on the relevant conversation of the current page and closes', async () => {
    invest().setActiveTab('financiamento')
    runTurn.mockResolvedValueOnce({ history: [], reply: 'ok', proposals: [] })
    await chat().sendMessage('sobre financiamento')
    const id = chat().conversationId
    chat().newChat()
    chat().openPanel()
    expect(chat()).toMatchObject({ panelOpen: true, conversationId: id })
    chat().closePanel()
    expect(chat().panelOpen).toBe(false)
  })
  it('opens the panel when the assistant sends the user to another page, not on the dashboard', () => {
    chat().goTo('strategy')
    expect(chat().panelOpen).toBe(true)
    chat().goTo('dashboard')
    expect(chat().panelOpen).toBe(false)
  })
})
