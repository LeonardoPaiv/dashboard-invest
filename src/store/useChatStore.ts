import { create } from 'zustand'
import { runAgentTurn } from '../chat/agent'
import { prepareAttachment } from '../chat/attachments'
import type { Proposal, ToolContext } from '../chat/tools'
import { collectCategories } from '../domain/assets'
import { OpenRouterError, type ChatMessage } from '../lib/openrouter/client'
import { useAiSettingsStore } from './useAiSettingsStore'
import { resolveWritablePortfolioId, useInvestmentStore } from './useInvestmentStore'

export interface ChatFile {
  name: string
  meta: string
}

export interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  file?: ChatFile
  proposals?: Proposal[]
  isError?: boolean
}

interface ChatStore {
  messages: UiMessage[]
  history: ChatMessage[]
  typing: boolean
  draft: string
  stagedFile: File | null
  composeRequest: number
  session: number
  setDraft: (text: string) => void
  stageFile: (file: File | null) => void
  requestCompose: (text: string) => void
  newChat: () => void
  sendMessage: (text: string) => Promise<void>
  confirmProposal: (messageId: string, proposalId: string) => void
  dismissProposal: (messageId: string, proposalId: string) => void
}

const DEFAULT_FILE_PROMPT = 'Importe as posições deste arquivo.'
const APP_NOTE = '(nota automática do app)'

const newId = () => crypto.randomUUID()

export function buildToolContext(): ToolContext {
  const state = useInvestmentStore.getState()
  const targetPortfolioId = resolveWritablePortfolioId(state.portfolios, state.activePortfolioId)
  const active = state.portfolios.find((p) => p.id === state.activePortfolioId)
  return {
    workspace: {
      portfolios: state.portfolios,
      categories: collectCategories(state.assetCategories, state.portfolios),
    },
    viewData: state.portfolio,
    viewLabel: active ? active.name : 'Todas as carteiras (consolidado)',
    targetPortfolioId,
    allocationTargets: state.settings.alvos,
    createId: newId,
  }
}

function errorText(error: unknown): string {
  if (error instanceof OpenRouterError) {
    if (error.status === 402) return 'Sua conta do OpenRouter está sem créditos para este modelo.'
    if (error.status === 429) return 'Limite de requisições do OpenRouter atingido. Aguarde um pouco e tente de novo.'
    return `Erro do OpenRouter: ${error.message}`
  }
  return 'Não consegui falar com o OpenRouter. Verifique sua conexão e tente de novo.'
}

export const useChatStore = create<ChatStore>()((set, get) => {
  const patchProposal = (messageId: string, proposalId: string, changes: Partial<Proposal>) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id !== messageId
          ? message
          : { ...message, proposals: message.proposals?.map((p) => (p.id === proposalId ? { ...p, ...changes } : p)) },
      ),
    }))

  const findPending = (messageId: string, proposalId: string): Proposal | undefined => {
    const found = get()
      .messages.find((m) => m.id === messageId)
      ?.proposals?.find((p) => p.id === proposalId)
    return found?.status === 'pending' ? found : undefined
  }

  const note = (content: string): ChatMessage => ({ role: 'user', content: `${APP_NOTE} ${content}` })

  return {
    messages: [],
    history: [],
    typing: false,
    draft: '',
    stagedFile: null,
    composeRequest: 0,
    session: 0,

    setDraft: (draft) => set({ draft }),
    stageFile: (stagedFile) => set({ stagedFile }),
    requestCompose: (draft) => set((state) => ({ draft, composeRequest: state.composeRequest + 1 })),
    newChat: () => set((state) => ({ messages: [], history: [], typing: false, session: state.session + 1 })),

    sendMessage: async (rawText) => {
      const { typing, stagedFile, session, history } = get()
      const typed = rawText.trim()
      if (typing || (typed === '' && !stagedFile)) return
      const text = typed || DEFAULT_FILE_PROMPT

      let file: ChatFile | undefined
      let userContent = text
      if (stagedFile) {
        try {
          const prepared = await prepareAttachment(stagedFile)
          file = { name: prepared.name, meta: prepared.meta }
          userContent = `${text}\n\n${prepared.promptText}`
        } catch (error) {
          set((state) => ({
            stagedFile: null,
            messages: [...state.messages, { id: newId(), role: 'assistant', text: (error as Error).message, isError: true }],
          }))
          return
        }
      }

      const userMessage: UiMessage = { id: newId(), role: 'user', text, ...(file ? { file } : {}) }
      set((state) => ({ messages: [...state.messages, userMessage], draft: '', stagedFile: null, typing: true }))

      const { apiKey, model } = useAiSettingsStore.getState()
      try {
        const result = await runAgentTurn({ apiKey, model, history, userContent, toolContext: buildToolContext() })
        if (get().session !== session) return
        set((state) => ({
          typing: false,
          history: result.history,
          messages: [
            ...state.messages,
            {
              id: newId(),
              role: 'assistant',
              text: result.reply,
              ...(result.proposals.length > 0 ? { proposals: result.proposals } : {}),
            },
          ],
        }))
      } catch (error) {
        if (get().session !== session) return
        if (error instanceof OpenRouterError && error.status === 401) {
          useAiSettingsStore.getState().markKeyStatus('invalid')
          set((state) => ({
            typing: false,
            draft: typed,
            stagedFile,
            messages: state.messages.filter((m) => m.id !== userMessage.id),
          }))
          return
        }
        set((state) => ({
          typing: false,
          messages: [...state.messages, { id: newId(), role: 'assistant', text: errorText(error), isError: true }],
        }))
      }
    },

    confirmProposal: (messageId, proposalId) => {
      const proposal = findPending(messageId, proposalId)
      if (!proposal) return
      try {
        useInvestmentStore.getState().applyAssetOperations(proposal.portfolioId, proposal.operations)
      } catch (error) {
        const message = (error as Error).message
        patchProposal(messageId, proposalId, { status: 'failed', error: message })
        set((state) => ({
          history: [...state.history, note(`A proposta ${proposalId} não pôde ser salva: ${message}`)],
        }))
        return
      }
      patchProposal(messageId, proposalId, { status: 'done' })
      const count = proposal.operations.length
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: newId(),
            role: 'assistant',
            text: `Pronto — ${count} ${count === 1 ? 'alteração salva' : 'alterações salvas'} em ${proposal.portfolioName}. O gráfico e a lista já refletem a mudança.`,
          },
        ],
        history: [...state.history, note(`O usuário confirmou a proposta ${proposalId}; as alterações foram salvas.`)],
      }))
    },

    dismissProposal: (messageId, proposalId) => {
      if (!findPending(messageId, proposalId)) return
      patchProposal(messageId, proposalId, { status: 'dismissed' })
      set((state) => ({
        history: [...state.history, note(`O usuário descartou a proposta ${proposalId}; nada foi salvo.`)],
      }))
    },
  }
})
