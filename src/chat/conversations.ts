import type { PageId } from '../domain/pages'
import type { ChatMessage } from '../lib/openrouter/client'
import type { UiMessage } from '../store/useChatStore'

export interface Conversation {
  id: string
  title: string
  /** Página em que a conversa foi usada por último. */
  page: PageId
  createdAt: string
  updatedAt: string
  messages: UiMessage[]
  history: ChatMessage[]
}

export const MAX_CONVERSATIONS = 30
export const MAX_STORED_CONTENT = 4000
export const MAX_STORED_CHARS = 1_000_000
const TITLE_LENGTH = 48
const OMITTED = '\n[conteúdo longo omitido ao salvar a conversa]'

export function conversationTitle(messages: UiMessage[]): string {
  const first = messages.find((message) => message.role === 'user')
  const line = (first?.text ?? '').replace(/\s+/g, ' ').trim()
  if (!line) return 'Nova conversa'
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line
}

export function saveConversation(list: Conversation[], conversation: Conversation): Conversation[] {
  return [conversation, ...list.filter((item) => item.id !== conversation.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_CONVERSATIONS)
}

export function relevantConversation(list: Conversation[], page: PageId): Conversation | undefined {
  return list.filter((item) => item.page === page).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

/** Planilhas anexadas chegam a 60 mil caracteres por mensagem; no disco fica só o começo, dentro de um orçamento total. */
export function forStorage(list: Conversation[]): Conversation[] {
  const result = list.map((conversation) => ({
    ...conversation,
    history: conversation.history.map((message) =>
      typeof message.content === 'string' && message.content.length > MAX_STORED_CONTENT
        ? { ...message, content: message.content.slice(0, MAX_STORED_CONTENT) + OMITTED }
        : message,
    ),
  }))
  // a lista vem da mais nova para a mais antiga: descarta as mais antigas, mantendo ao menos a mais nova
  while (result.length > 1 && JSON.stringify(result).length > MAX_STORED_CHARS) result.pop()
  return result
}
