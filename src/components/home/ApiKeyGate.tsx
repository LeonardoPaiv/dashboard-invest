import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { validateKey } from '../../lib/openrouter/client'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'

export const ApiKeyGate = () => {
  const keyStatus = useAiSettingsStore((s) => s.keyStatus)
  const setApiKey = useAiSettingsStore((s) => s.setApiKey)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const key = value.trim()
    if (!key || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await validateKey(key)
      if (result === 'valid') setApiKey(key, 'valid')
      else setError('Chave inválida. Confira e tente novamente.')
    } catch {
      setError('Não foi possível validar a chave agora. Verifique sua conexão e tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const refused = keyStatus === 'invalid' && !error

  return (
    <form
      onSubmit={submit}
      className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 flex flex-col items-center justify-center gap-5 text-center"
    >
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <KeyRound size={22} />
      </div>
      <div className="max-w-sm">
        <h4 className="text-xl font-black tracking-tight">Conecte sua chave do OpenRouter</h4>
        <p className="mt-2 text-[13px] text-white/40">
          O assistente usa modelos via OpenRouter. A chave fica salva apenas neste navegador e é enviada somente para
          openrouter.ai.
        </p>
      </div>
      <div className="w-full max-w-sm flex flex-col gap-2">
        <input
          aria-label="Chave da API do OpenRouter"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-or-v1-…"
          className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-primary/50"
        />
        {(error || refused) && (
          <p role="alert" className="text-xs font-bold text-red-400">
            {error ?? 'A chave salva foi recusada pelo OpenRouter. Informe uma nova.'}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || value.trim() === ''}
          className="px-4 py-3 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-wide hover:bg-emerald-600 disabled:bg-white/10 disabled:text-white/30 transition-colors"
        >
          {busy ? 'Validando…' : 'Salvar chave'}
        </button>
      </div>
      <a
        href="https://openrouter.ai/keys"
        target="_blank"
        rel="noreferrer"
        className="text-[11px] font-bold text-primary hover:text-emerald-300"
      >
        Criar uma chave em openrouter.ai/keys
      </a>
    </form>
  )
}
