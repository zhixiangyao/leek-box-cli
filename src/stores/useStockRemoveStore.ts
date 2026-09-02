import { create } from 'zustand'

import { errorMessage } from '../lib/error.ts'
import { loadStocks } from '../settings/file.ts'
import { type StockEntry } from '../settings/schema.ts'

type StockRemoveState = {
  entries: StockEntry[]
  errorMessage: string | undefined
  resetToken: number
  loadEntries: () => Promise<void>
  removeByCodes: (codes: readonly string[]) => void
}

export type StockRemoveDependencies = {
  loadStocks: () => Promise<StockEntry[]>
}

const defaultDependencies: StockRemoveDependencies = { loadStocks }

export function createStockRemoveStore(dependencies: StockRemoveDependencies = defaultDependencies) {
  return create<StockRemoveState>()((set) => ({
    entries: [],
    errorMessage: undefined,
    resetToken: 0,

    loadEntries: async () => {
      set({ errorMessage: undefined })
      try {
        const entries = await dependencies.loadStocks()
        set({ entries })
      } catch (error) {
        set({ entries: [], errorMessage: errorMessage(error) })
      }
    },

    removeByCodes: (codes) => {
      const drop = new Set(codes)
      set((state) => ({
        entries: state.entries.filter((entry) => !drop.has(entry.code)),
        resetToken: state.resetToken + 1,
      }))
    },
  }))
}

export const useStockRemoveStore = createStockRemoveStore()
