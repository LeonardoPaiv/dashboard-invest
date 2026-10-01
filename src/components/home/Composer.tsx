import { useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import { ArrowUp, FileSpreadsheet, Paperclip, X } from 'lucide-react'
import { ACCEPTED_EXTENSIONS } from '../../chat/attachments'
import { useChatStore } from '../../store/useChatStore'
import { CHAT_FILE_INPUT_ID, CHAT_HELPERS } from './chatHelpers'

export const Composer = () => {
  const draft = useChatStore((s) => s.draft)
  const typing = useChatStore((s) => s.typing)
  const stagedFile = useChatStore((s) => s.stagedFile)
  const composeRequest = useChatStore((s) => s.composeRequest)
  const hasMessages = useChatStore((s) => s.messages.length > 0)
  const setDraft = useChatStore((s) => s.setDraft)
  const stageFile = useChatStore((s) => s.stageFile)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (composeRequest > 0) textareaRef.current?.focus()
  }, [composeRequest])

  const canSend = !typing && (draft.trim() !== '' || stagedFile !== null)

  const send = () => {
    if (canSend) void sendMessage(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) stageFile(file)
    event.target.value = ''
  }

  return (
    <div className="px-6 pb-5 flex flex-col gap-2.5">
      {hasMessages && (
        <div className="flex gap-2 flex-wrap max-w-[640px] w-full mx-auto">
          {CHAT_HELPERS.map((helper) => (
            <button
              key={helper.title}
              type="button"
              onClick={helper.run}
              className="px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/60 text-[11px] font-bold whitespace-nowrap hover:text-white hover:border-primary/40 hover:bg-primary/[0.08] transition-colors"
            >
              {helper.title}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-[640px] w-full mx-auto bg-white/5 border border-white/10 rounded-3xl pt-3 pr-3 pb-2.5 pl-[18px] flex flex-col gap-2">
        {stagedFile && (
          <div className="self-start flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <FileSpreadsheet size={14} className="text-primary shrink-0" />
            <span className="text-[11px] font-bold truncate max-w-[220px]">{stagedFile.name}</span>
            <button
              type="button"
              aria-label="Remover anexo"
              onClick={() => stageFile(null)}
              className="p-0.5 rounded-md text-white/40 hover:text-white hover:bg-white/10"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Pergunte algo ou cole os dados da sua corretora…"
          className="w-full resize-none bg-transparent border-none outline-none text-white text-[13px] leading-normal py-1 placeholder:text-white/30"
        />
        <div className="flex justify-between items-center">
          <label
            title="Anexar planilha (.xlsx, .xls, .csv)"
            className="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full border border-white/10 text-white/60 cursor-pointer hover:text-white hover:bg-white/5 transition-colors"
          >
            <Paperclip size={16} />
            <span className="text-[11px] font-bold">Anexar</span>
            <input
              id={CHAT_FILE_INPUT_ID}
              aria-label="Anexar planilha"
              type="file"
              className="hidden"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              onChange={onFile}
            />
          </label>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            aria-label="Enviar"
            title="Enviar"
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center bg-primary text-white disabled:bg-white/10 disabled:text-white/30 transition-colors"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>

      <div className="text-center text-[10px] text-white/25 font-semibold">
        Nada é salvo sem sua confirmação. Respostas podem conter erros — confira os valores.
      </div>
    </div>
  )
}
