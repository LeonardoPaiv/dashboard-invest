import { useEffect } from 'react'
import { validateKey } from '../lib/openrouter/client'
import { useAiSettingsStore } from '../store/useAiSettingsStore'

/** Revalida, uma vez por carregamento, a chave salva de uma sessão anterior. */
export function useKeyRevalidation(): void {
  const apiKey = useAiSettingsStore((s) => s.apiKey)
  const keyStatus = useAiSettingsStore((s) => s.keyStatus)
  const markKeyStatus = useAiSettingsStore((s) => s.markKeyStatus)

  useEffect(() => {
    if (keyStatus !== 'unknown' || !apiKey) return
    let cancelled = false
    validateKey(apiKey)
      .then((result) => {
        if (!cancelled) markKeyStatus(result)
      })
      .catch(() => {
        // Sem rede ou OpenRouter fora do ar: mantém "unknown" e deixa o chat tentar.
      })
    return () => {
      cancelled = true
    }
  }, [apiKey, keyStatus, markKeyStatus])
}
