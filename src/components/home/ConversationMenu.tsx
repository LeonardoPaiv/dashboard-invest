import { useState } from 'react'
import { History, Trash2 } from 'lucide-react'
import { pageLabel } from '../../domain/pages'
import { useChatStore } from '../../store/useChatStore'

const day = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export const ConversationMenu = () => {
  const conversations = useChatStore((s) => s.conversations)
  const conversationId = useChatStore((s) => s.conversationId)
  const openConversation = useChatStore((s) => s.openConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const [open, setOpen] = useState(false)

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Conversas"
        aria-label="Conversas"
        aria-expanded={open}
        className="w-[34px] h-[34px] flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      >
        <History size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label="Conversas salvas"
            className="absolute right-0 top-[42px] z-20 w-72 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto custom-scrollbar bg-card border border-white/10 rounded-2xl shadow-2xl p-1.5"
          >
            {conversations.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px] text-white/40 font-semibold">Nenhuma conversa salva ainda.</div>
            )}
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`flex items-center gap-1 rounded-xl ${conversation.id === conversationId ? 'bg-primary/10' : 'hover:bg-white/5'}`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openConversation(conversation.id)
                    setOpen(false)
                  }}
                  className="flex-1 min-w-0 text-left px-3 py-2"
                >
                  <div className="text-xs font-bold text-white/90 truncate">{conversation.title}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-semibold">
                    <span>{pageLabel(conversation.page)}</span>
                    <span>·</span>
                    <span>{day(conversation.updatedAt)}</span>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Apagar conversa ${conversation.title}`}
                  title="Apagar conversa"
                  onClick={() => deleteConversation(conversation.id)}
                  className="p-2 mr-1 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
