import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_MODEL } from '../lib/openrouter/models'

export type KeyStatus = 'missing' | 'unknown' | 'valid' | 'invalid'

interface AiSettingsStore {
  apiKey: string
  keyStatus: KeyStatus
  model: string
  webSearch: boolean
  setApiKey: (key: string, status: KeyStatus) => void
  markKeyStatus: (status: KeyStatus) => void
  clearApiKey: () => void
  setModel: (model: string) => void
  setWebSearch: (on: boolean) => void
}

export const useAiSettingsStore = create<AiSettingsStore>()(
  persist(
    (set) => ({
      apiKey: '',
      keyStatus: 'missing',
      model: DEFAULT_MODEL,
      webSearch: true,
      setApiKey: (key, status) => set({ apiKey: key.trim(), keyStatus: status }),
      markKeyStatus: (keyStatus) => set({ keyStatus }),
      clearApiKey: () => set({ apiKey: '', keyStatus: 'missing' }),
      setModel: (model) => set((state) => ({ model: model.trim() || state.model })),
      setWebSearch: (webSearch) => set({ webSearch }),
    }),
    {
      name: 'ai-settings',
      partialize: (state) => ({ apiKey: state.apiKey, model: state.model, webSearch: state.webSearch }),
      merge: (persisted, current) => {
        const saved = (persisted || {}) as Partial<AiSettingsStore>
        return {
          ...current,
          apiKey: saved.apiKey || '',
          model: saved.model || current.model,
          webSearch: typeof saved.webSearch === 'boolean' ? saved.webSearch : current.webSearch,
          keyStatus: saved.apiKey ? 'unknown' : 'missing',
        }
      },
    },
  ),
)
