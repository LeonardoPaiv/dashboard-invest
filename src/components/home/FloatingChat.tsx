import { Bot } from 'lucide-react'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'
import { ChatPanel } from './ChatPanel'

/** Fora do Dashboard (onde o chat fica ancorado), o assistente mora no canto inferior direito. */
export const FloatingChat = () => {
  const activeTab = useInvestmentStore((s) => s.activeTab)
  const panelOpen = useChatStore((s) => s.panelOpen)
  const typing = useChatStore((s) => s.typing)
  const openPanel = useChatStore((s) => s.openPanel)
  const closePanel = useChatStore((s) => s.closePanel)

  if (activeTab === 'dashboard') return null

  if (!panelOpen) {
    return (
      <button
        type="button"
        onClick={openPanel}
        title="Abrir assistente"
        aria-label="Abrir assistente"
        className="fixed z-40 bottom-5 right-5 w-14 h-14 rounded-full bg-primary text-white shadow-2xl shadow-primary/30 flex items-center justify-center hover:bg-emerald-600 transition-colors"
      >
        <Bot size={24} />
        {typing && <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-amber-400 animate-pulse" />}
      </button>
    )
  }

  return (
    <div className="fixed z-40 inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[460px] md:h-[min(720px,calc(100dvh-48px))] flex">
      <ChatPanel variant="floating" onClose={closePanel} />
    </div>
  )
}
