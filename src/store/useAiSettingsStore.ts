import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_MODEL } from '../lib/openrouter/models'

export type KeyStatus = 'missing' | 'unknown' | 'valid' | 'invalid'

interface AiSettingsStore {
  apiKey: string
  keyStatus: KeyStatus
  model: string
  setApiKey: (key: string, status: KeyStatus) => void
  markKeyStatus: (status: KeyStatus) => void
  clearApiKey: () => void
  setModel: (model: string) => void
}

export const useAiSettingsStore = create<AiSettingsStore>()(
  persist(
    (set) => ({
      apiKey: '',
      keyStatus: 'missing',
      model: DEFAULT_MODEL,
      setApiKey: (key, status) => set({ apiKey: key.trim(), keyStatus: status }),
      markKeyStatus: (keyStatus) => set({ keyStatus }),
      clearApiKey: () => set({ apiKey: '', keyStatus: 'missing' }),
      setModel: (model) => set((state) => ({ model: model.trim() || state.model })),
    }),
    {
      name: 'ai-settings',
      partialize: (state) => ({ apiKey: state.apiKey, model: state.model }),
      merge: (persisted, current) => {
        const saved = (persisted || {}) as Partial<AiSettingsStore>
        return {
          ...current,
          apiKey: saved.apiKey || '',
          model: saved.model || current.model,
          keyStatus: saved.apiKey ? 'unknown' : 'missing',
        }
      },
    },
  ),
)
