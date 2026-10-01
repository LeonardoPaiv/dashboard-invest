import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { runAgentTurn } from '../chat/agent'
import { readSettingsSnapshot, writeSettingsSnapshot } from '../chat/appState'
import { prepareAttachment } from '../chat/attachments'
import { conversationTitle, forStorage, relevantConversation, saveConversation, type Conversation } from '../chat/conversations'
import type { Proposal, ToolContext } from '../chat/tools'
import { collectCategories } from '../domain/assets'
import { isPageId, type PageId } from '../domain/pages'
import { runSettingsOperations } from '../domain/settingsOperations'
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
  conversations: Conversation[]
  conversationId: string | null
  panelOpen: boolean
  setDraft: (text: string) => void
  stageFile: (file: File | null) => void
  requestCompose: (text: string) => void
  newChat: () => void
  sendMessage: (text: string) => Promise<void>
  confirmProposal: (messageId: string, proposalId: string) => void
  dismissProposal: (messageId: string, proposalId: string) => void
  goTo: (page: PageId) => void
  openConversation: (id: string) => void
  deleteConversation: (id: string) => void
  openRelevant: (page: PageId) => void
  clearConversations: () => void
  openPanel: () => void
  closePanel: () => void
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
    currentPage: isPageId(state.activeTab) ? state.activeTab : 'dashboard',
    navigate: (page) => useChatStore.getState().goTo(page),
    selectPortfolio: (id) => useInvestmentStore.getState().setActivePortfolio(id),
    app: readSettingsSnapshot(),
    monthlyHistory: state.monthlySnapshots.map(({ date, totalIncome, totalExpense, savings }) => ({ date, totalIncome, totalExpense, savings })),
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

const safeStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      // cota cheia ou storage bloqueado: a conversa segue só na memória
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name)
    } catch {
      // idem
    }
  },
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => {
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
        conversations: [],
        conversationId: null,
        panelOpen: false,

        setDraft: (draft) => set({ draft }),
        stageFile: (stagedFile) => set({ stagedFile }),
        requestCompose: (draft) => set((state) => ({ draft, composeRequest: state.composeRequest + 1 })),
        newChat: () =>
          set((state) => ({ messages: [], history: [], typing: false, session: state.session + 1, conversationId: null })),

        sendMessage: async (rawText) => {
          const { typing, stagedFile, session, history } = get()
          const typed = rawText.trim()
          if (typing || (typed === '' && !stagedFile)) return
          const text = typed || DEFAULT_FILE_PROMPT
          set({ typing: true })

          let file: ChatFile | undefined
          let userContent = text
          if (stagedFile) {
            try {
              const prepared = await prepareAttachment(stagedFile)
              file = { name: prepared.name, meta: prepared.meta }
              userContent = `${text}\n\n${prepared.promptText}`
              if (get().session !== session) return
            } catch (error) {
              if (get().session !== session) return
              set((state) => ({
                typing: false,
                stagedFile: null,
                messages: [...state.messages, { id: newId(), role: 'assistant', text: (error as Error).message, isError: true }],
              }))
              return
            }
          }

          const userMessage: UiMessage = { id: newId(), role: 'user', text, ...(file ? { file } : {}) }
          set((state) => ({ messages: [...state.messages, userMessage], draft: '', stagedFile: null }))

          const { apiKey, model } = useAiSettingsStore.getState()
          try {
            const result = await runAgentTurn({ apiKey, model, history, userContent, toolContext: buildToolContext })
            if (get().session !== session) return
            set((state) => ({
              typing: false,
              // keep notes added (confirm/dismiss) while this reply was pending
              history: [...result.history, ...state.history.slice(history.length)],
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
            if (proposal.settings) {
              const { snapshot, errors } = runSettingsOperations(readSettingsSnapshot(), proposal.settings.operations)
              if (errors.length > 0) throw new Error(errors.join('\n'))
              writeSettingsSnapshot(snapshot)
            } else {
              useInvestmentStore.getState().applyAssetOperations(proposal.portfolioId, proposal.operations)
            }
          } catch (error) {
            const message = (error as Error).message
            patchProposal(messageId, proposalId, { status: 'failed', error: message })
            set((state) => ({
              history: [...state.history, note(`A proposta ${proposalId} não pôde ser salva: ${message}`)],
            }))
            return
          }
          patchProposal(messageId, proposalId, { status: 'done' })
          const count = proposal.settings ? proposal.settings.operations.length : proposal.operations.length
          set((state) => ({
            messages: [
              ...state.messages,
              {
                id: newId(),
                role: 'assistant',
                text: proposal.settings
                  ? `Pronto — ${count} ${count === 1 ? 'alteração salva' : 'alterações salvas'} em ${proposal.portfolioName}.`
                  : `Pronto — ${count} ${count === 1 ? 'alteração salva' : 'alterações salvas'} em ${proposal.portfolioName}. O gráfico e a lista já refletem a mudança.`,
              },
            ],
            history: [...state.history, note(`O usuário confirmou a proposta ${proposalId}; as alterações foram salvas.`)],
          }))
          if (proposal.page) get().goTo(proposal.page)
        },

        dismissProposal: (messageId, proposalId) => {
          if (!findPending(messageId, proposalId)) return
          patchProposal(messageId, proposalId, { status: 'dismissed' })
          set((state) => ({
            history: [...state.history, note(`O usuário descartou a proposta ${proposalId}; nada foi salvo.`)],
          }))
        },

        openConversation: (id) => {
          const found = get().conversations.find((c) => c.id === id)
          if (!found) return
          set((state) => ({
            messages: found.messages,
            history: found.history,
            conversationId: found.id,
            typing: false,
            session: state.session + 1,
          }))
        },

        deleteConversation: (id) =>
          set((state) => ({
            conversations: state.conversations.filter((c) => c.id !== id),
            ...(state.conversationId === id
              ? { messages: [], history: [], conversationId: null, typing: false, session: state.session + 1 }
              : {}),
          })),

        openRelevant: (page) => {
          const state = get()
          if (state.typing) return
          const open = state.conversations.find((c) => c.id === state.conversationId)
          if (state.messages.length > 0 && open?.page === page) return
          const match = relevantConversation(state.conversations, page)
          if (match) get().openConversation(match.id)
          else if (state.messages.length > 0) get().newChat()
        },

        clearConversations: () =>
          set((state) => ({
            conversations: [], messages: [], history: [], conversationId: null, typing: false, session: state.session + 1,
          })),

        goTo: (page) => {
          useInvestmentStore.getState().setActiveTab(page)
          set((state) => ({
            conversations: state.conversations.map((c) => (c.id === state.conversationId ? { ...c, page } : c)),
            panelOpen: page !== 'dashboard',
          }))
        },

        openPanel: () => {
          get().openRelevant(currentPage())
          set({ panelOpen: true })
        },
        closePanel: () => set({ panelOpen: false }),
      }
    },
    {
      name: 'chat-conversations',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ conversations: forStorage(state.conversations), conversationId: state.conversationId }),
      merge: (persisted, current) => {
        const saved = (persisted || {}) as Partial<Pick<ChatStore, 'conversations' | 'conversationId'>>
        const conversations = Array.isArray(saved.conversations) ? saved.conversations : []
        const open = conversations.find((c) => c.id === saved.conversationId)
        return {
          ...current,
          conversations,
          conversationId: open ? open.id : null,
          messages: open ? open.messages : [],
          history: open ? open.history : [],
        }
      },
    },
  ),
)

const currentPage = (): PageId => {
  const tab = useInvestmentStore.getState().activeTab
  return isPageId(tab) ? tab : 'dashboard'
}

useChatStore.subscribe((state, previous) => {
  if (state.messages === previous.messages && state.history === previous.history) return
  if (state.messages.length === 0) return
  const existing = state.conversations.find((c) => c.id === state.conversationId)
  // acabou de abrir uma conversa salva: nada mudou de fato
  if (existing && existing.messages === state.messages && existing.history === state.history) return
  const id = state.conversationId ?? newId()
  const now = new Date().toISOString()
  useChatStore.setState({
    conversationId: id,
    conversations: saveConversation(state.conversations, {
      id,
      title: conversationTitle(state.messages),
      page: existing?.page ?? currentPage(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messages: state.messages,
      history: state.history,
    }),
  })
})
