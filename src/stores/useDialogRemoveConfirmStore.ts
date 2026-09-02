import { create } from 'zustand'

import { errorMessage } from '../lib/error.ts'
import { stocksRemove } from '../settings/file.ts'
import { type StockEntry } from '../settings/schema.ts'
import { useStockRemoveStore } from './useStockRemoveStore.ts'

export type DialogRemoveConfirmStep =
  | { type: 'idle' }
  | { type: 'confirm' }
  | { type: 'removing' }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string }

type DialogRemoveConfirmState = {
  step: DialogRemoveConfirmStep
  targets: StockEntry[]
  open: (targets: StockEntry[]) => void
  confirmDelete: () => Promise<void>
  close: () => void
}

export type DialogRemoveConfirmDependencies = {
  stocksRemove: (codes: string[]) => Promise<number>
  commitRemoval: (codes: string[]) => void
}

const defaultDependencies: DialogRemoveConfirmDependencies = {
  stocksRemove,
  commitRemoval: (codes) => useStockRemoveStore.getState().removeByCodes(codes),
}

export function createDialogRemoveConfirmStore(dependencies: DialogRemoveConfirmDependencies = defaultDependencies) {
  return create<DialogRemoveConfirmState>()((set, get) => ({
    step: { type: 'idle' },
    targets: [],

    open: (targets) => {
      if (get().step.type !== 'idle' || targets.length === 0) return
      set({ step: { type: 'confirm' }, targets })
    },

    confirmDelete: async () => {
      if (get().step.type !== 'confirm') return
      const codes = get().targets.map((entry) => entry.code)
      const count = codes.length
      set({ step: { type: 'removing' } })
      try {
        const removedCount = await dependencies.stocksRemove(codes)
        if (removedCount === 0) {
          set({ step: { type: 'error', message: `所选 ${count} 个条目已不在自选股中.` } })
          return
        }
        dependencies.commitRemoval(codes)
        const missingCount = count - removedCount
        if (missingCount > 0) {
          set({
            step: { type: 'done', message: `已删除 ${removedCount} 个股票, ${missingCount} 个条目已不在自选股中.` },
            targets: [],
          })
          return
        }
        set({ step: { type: 'idle' }, targets: [] })
      } catch (error) {
        set({ step: { type: 'error', message: `删除失败: ${errorMessage(error)}` } })
      }
    },

    close: () => {
      const type = get().step.type

      if (type === 'removing') return

      set({ step: { type: 'idle' }, targets: [] })
    },
  }))
}

export const useDialogRemoveConfirmStore = createDialogRemoveConfirmStore()
