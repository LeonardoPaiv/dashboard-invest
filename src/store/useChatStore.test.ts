import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runAgentTurn } from '../chat/agent'
import { prepareAttachment } from '../chat/attachments'
import type { Proposal } from '../chat/tools'
import { OpenRouterError } from '../lib/openrouter/client'
import { DEFAULT_MODEL } from '../lib/openrouter/models'
import { useAiSettingsStore } from './useAiSettingsStore'
import { buildToolContext, useChatStore } from './useChatStore'
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
