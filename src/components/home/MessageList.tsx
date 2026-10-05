import { useEffect, useRef } from 'react'
import { Bot, FileSpreadsheet } from 'lucide-react'
import type { Citation } from '../../lib/openrouter/client'
import { shortModelName } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { useChatStore, type UiMessage } from '../../store/useChatStore'
import { CHAT_HELPERS } from './chatHelpers'
import { ProposalCard } from './ProposalCard'

const BotAvatar = () => (
  <div className="w-7 h-7 rounded-[9px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
    <Bot size={15} />
  </div>
)

const UserMessage = ({ message }: { message: UiMessage }) => (
  <div className="flex flex-col items-end gap-1.5">
    {message.file && (
      <div className="flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-[14px] bg-white/5 border border-white/10">
        <div className="w-8 h-8 rounded-[10px] bg-primary/15 text-primary flex items-center justify-center">
          <FileSpreadsheet size={16} />
        </div>
        <div>
          <div className="text-xs font-bold">{message.file.name}</div>
          <div className="text-[10px] text-white/40 font-semibold">{message.file.meta}</div>
        </div>
      </div>
    )}
    <div className="max-w-[80%] px-4 py-2.5 rounded-[20px] bg-white/[0.07] text-[13px] leading-relaxed whitespace-pre-wrap break-words">
      {message.text}
    </div>
  </div>
)

const MAX_SOURCES = 6

const sourceLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const Sources = ({ sources }: { sources: Citation[] }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mr-1">Fontes</span>
    {sources.slice(0, MAX_SOURCES).map((source) => (
      <a
        key={source.url}
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        title={source.title || source.url}
        className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-semibold text-white/60 hover:text-white hover:border-primary/30 transition-colors"
      >
        {sourceLabel(source.url)}
      </a>
    ))}
  </div>
)

const AssistantMessage = ({ message }: { message: UiMessage }) => (
  <div className="flex gap-3 items-start">
    <BotAvatar />
    <div className="flex-1 min-w-0 flex flex-col gap-3 pt-1">
      <div
        className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
          message.isError ? 'text-red-400' : 'text-white/85'
        }`}
      >
        {message.text}
      </div>
      {message.sources && message.sources.length > 0 && <Sources sources={message.sources} />}
      {message.proposals?.map((proposal) => (
        <ProposalCard key={proposal.id} messageId={message.id} proposal={proposal} />
      ))}
    </div>
  </div>
)

export const MessageList = () => {
  const messages = useChatStore((s) => s.messages)
  const typing = useChatStore((s) => s.typing)
  const model = useAiSettingsStore((s) => s.model)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, typing])

  const isEmpty = messages.length === 0 && !typing

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
      {isEmpty && (
        <div className="h-full flex flex-col items-center justify-center gap-6 text-center max-w-[520px] mx-auto">
          <div>
            <h4 className="text-2xl font-black tracking-tight">Como posso ajudar?</h4>
            <p className="mt-2 text-[13px] text-white/40">
              Envie um extrato ou planilha, ou peça para ajustar metas, plano mensal, financiamento e projeção — eu
              mostro uma prévia antes de salvar.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
            {CHAT_HELPERS.map((helper) => (
              <button
                key={helper.title}
                type="button"
                onClick={helper.run}
                className="text-left p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-white flex flex-col gap-1.5 hover:bg-white/5 hover:border-primary/30 transition-colors"
              >
                <span className="text-xs font-black">{helper.title}</span>
                <span className="text-[11px] text-white/40 font-semibold leading-snug">{helper.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 max-w-[640px] mx-auto">
        {messages.map((message) =>
          message.role === 'user' ? (
            <UserMessage key={message.id} message={message} />
          ) : (
            <AssistantMessage key={message.id} message={message} />
          ),
        )}
        {typing && (
          <div className="flex gap-3 items-center">
            <BotAvatar />
            <span className="text-xs text-white/40 font-semibold">{shortModelName(model)} está analisando…</span>
          </div>
        )}
      </div>
    </div>
  )
}
