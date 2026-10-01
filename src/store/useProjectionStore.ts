import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectionParams } from '../domain/settingsOperations'

interface ProjectionStore extends ProjectionParams {
  setProjection: (partial: Partial<ProjectionParams>) => void
}

export const useProjectionStore = create<ProjectionStore>()(
  persist(
    (set) => ({
      monthlyContribution: 1000,
      annualRate: 10,
      years: 10,
      setProjection: (partial) => set(partial),
    }),
    { name: 'projection-settings' },
  ),
)
