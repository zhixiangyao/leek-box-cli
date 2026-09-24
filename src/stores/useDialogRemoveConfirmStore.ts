import { create } from 'zustand'

import { t } from '../i18n/core.ts'
import { errorMessage } from '../lib/error.ts'
import { stocksRemove } from '../settings/file.ts'
import { type StockRemoveEntry } from './useStockRemoveStore.ts'

export type DialogRemoveConfirmStep =
  | { type: 'idle' }
  | { type: 'confirm' }
  | { type: 'removing' }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string }

type DialogRemoveConfirmState = {
  step: DialogRemoveConfirmStep
  entries: StockRemoveEntry[]
  open: (entries: StockRemoveEntry[]) => void
  close: () => void
  confirmDelete: (cb?: (codes: StockRemoveEntry['code'][]) => void) => Promise<void>
}

export type DialogRemoveConfirmDependencies = {
  stocksRemove: typeof stocksRemove
}

const defaultDependencies: DialogRemoveConfirmDependencies = {
  stocksRemove,
}

export function createDialogRemoveConfirmStore(dependencies: DialogRemoveConfirmDependencies = defaultDependencies) {
  return create<DialogRemoveConfirmState>()((set, get) => ({
    step: { type: 'idle' },
    entries: [],
    open: (entries) => {
      if (get().step.type !== 'idle' || entries.length === 0) return
      set({ step: { type: 'confirm' }, entries })
    },
    close: () => {
      const type = get().step.type

      if (type === 'removing') return

      set({ step: { type: 'idle' }, entries: [] })
    },
    confirmDelete: async (cb) => {
      if (get().step.type !== 'confirm') return
      const codes = get().entries.map((entry) => entry.code)
      const count = codes.length
      set({ step: { type: 'removing' } })
      try {
        const removedCount = await dependencies.stocksRemove(codes)
        if (removedCount === 0) {
          set({ step: { type: 'error', message: t('dialogRemoveConfirm.allMissing', { count }) } })
          return
        }
        cb?.(codes)
        const missingCount = count - removedCount
        if (missingCount > 0) {
          set({
            step: {
              type: 'done',
              message: t('dialogRemoveConfirm.done', { count: removedCount, missing: missingCount }),
            },
            entries: [],
          })
          return
        }
        set({ step: { type: 'idle' }, entries: [] })
      } catch (error) {
        set({ step: { type: 'error', message: t('dialogRemoveConfirm.failed', { error: errorMessage(error) }) } })
      }
    },
  }))
}

export const useDialogRemoveConfirmStore = createDialogRemoveConfirmStore()
