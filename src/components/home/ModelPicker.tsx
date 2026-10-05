import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { MODEL_PRESETS, shortModelName } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'

export const ModelPicker = () => {
  const model = useAiSettingsStore((s) => s.model)
  const setModel = useAiSettingsStore((s) => s.setModel)
  const clearApiKey = useAiSettingsStore((s) => s.clearApiKey)
  const webSearch = useAiSettingsStore((s) => s.webSearch)
  const setWebSearch = useAiSettingsStore((s) => s.setWebSearch)
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const choose = (id: string) => {
    setModel(id)
    setCustom('')
    setOpen(false)
  }

  const onCustomKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && custom.trim() !== '') {
      event.preventDefault()
      choose(custom)
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={model}
        className="flex items-center gap-2 px-3 py-1.5 min-w-0 max-w-[200px] bg-black/20 border border-white/5 rounded-xl text-white hover:border-primary/30 transition-colors"
      >
        <span className="w-[7px] h-[7px] rounded-full bg-primary shrink-0" />
        <span className="text-[11px] font-bold truncate">{shortModelName(model)}</span>
        {webSearch && <Globe size={11} aria-label="Busca na web ligada" className="text-primary shrink-0" />}
        <ChevronDown size={12} className="text-white/30 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 min-w-[260px] bg-[#0a0a0a] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-50">
          <div className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">
            Modelos via OpenRouter
          </div>
          {MODEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => choose(preset.id)}
              className={`w-full flex justify-between items-center gap-3 text-left px-3 py-2 rounded-lg transition-colors ${
                preset.id === model ? 'bg-primary text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-[11px] font-bold">{preset.id}</span>
              <span className="text-[10px] font-semibold opacity-60">{preset.note}</span>
            </button>
          ))}
          <div className="mt-1.5 pt-1.5 border-t border-white/5 flex flex-col gap-1.5">
            <input
              aria-label="Outro modelo"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={onCustomKeyDown}
              placeholder="Outro modelo: provedor/nome + Enter"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white placeholder:text-white/30 outline-none focus:border-primary/50"
            />
            <button
              type="button"
              role="switch"
              aria-checked={webSearch}
              onClick={() => setWebSearch(!webSearch)}
              className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-white/60 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Globe size={13} className={webSearch ? 'text-primary' : 'text-white/30'} />
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] font-bold">Busca na web</span>
                <span className="block text-[10px] font-semibold text-white/30">Cotações e índices; cobrada à parte pelo OpenRouter</span>
              </span>
              <span
                className={`w-7 h-4 rounded-full p-0.5 shrink-0 transition-colors ${webSearch ? 'bg-primary' : 'bg-white/10'}`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white transition-transform ${webSearch ? 'translate-x-3' : ''}`}
                />
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                clearApiKey()
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold text-white/60 hover:bg-white/5 hover:text-white transition-colors"
            >
              Trocar chave da API
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
