import { Bot, SquarePen, X } from 'lucide-react'
import { useKeyRevalidation } from '../../hooks/useKeyRevalidation'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { useChatStore } from '../../store/useChatStore'
import { ApiKeyGate } from './ApiKeyGate'
import { Composer } from './Composer'
import { ConversationMenu } from './ConversationMenu'
import { MessageList } from './MessageList'
import { ModelPicker } from './ModelPicker'

interface Props {
  variant?: 'docked' | 'floating'
  onClose?: () => void
}

export const ChatPanel = ({ variant = 'docked', onClose }: Props) => {
  const keyStatus = useAiSettingsStore((s) => s.keyStatus)
  const newChat = useChatStore((s) => s.newChat)
  const title = useChatStore((s) => s.conversations.find((c) => c.id === s.conversationId)?.title)
  useKeyRevalidation()

  const locked = keyStatus === 'missing' || keyStatus === 'invalid'

  return (
    <section
      className={
        variant === 'floating'
          ? 'bg-card border border-white/10 flex flex-col min-h-0 w-full h-full shadow-2xl relative md:rounded-[28px]'
          : 'bg-card border border-white/10 rounded-[32px] flex flex-col min-h-0 shadow-2xl relative'
      }
    >
      <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-white/5 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bot size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black tracking-tight text-white/90">Assistente</h3>
            <div className="text-[11px] text-white/40 font-semibold truncate">
              {title ?? 'Importa, organiza e configura seu painel'}
            </div>
          </div>
        </div>
        {!locked && (
          <div className="flex items-center gap-2 ml-auto min-w-0">
            <ModelPicker />
            <ConversationMenu />
            <button
              type="button"
              onClick={newChat}
              title="Nova conversa"
              aria-label="Nova conversa"
              className="w-[34px] h-[34px] flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <SquarePen size={16} />
            </button>
          </div>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Fechar assistente"
            aria-label="Fechar assistente"
            className="w-[34px] h-[34px] flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {locked ? (
        <ApiKeyGate />
      ) : (
        <>
          <MessageList />
          <Composer />
        </>
      )}
    </section>
  )
}
