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

/** 打开者登记的收尾动作: 参数是这次提交删除的条目代码 */
type DialogRemoveConfirmOnRemoved = (codes: StockRemoveEntry['code'][]) => void

type DialogRemoveConfirmState = {
  step: DialogRemoveConfirmStep
  entries: StockRemoveEntry[]
  onRemoved: DialogRemoveConfirmOnRemoved | undefined
  open: (entries: StockRemoveEntry[], onRemoved?: DialogRemoveConfirmOnRemoved) => void
  close: () => void
  confirmDelete: () => Promise<void>
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
    onRemoved: undefined,
    open: (entries, onRemoved) => {
      if (get().step.type !== 'idle' || entries.length === 0) return
      set({ step: { type: 'confirm' }, entries, onRemoved })
    },
    close: () => {
      const type = get().step.type

      if (type === 'removing') return

      set({ step: { type: 'idle' }, entries: [], onRemoved: undefined })
    },
    confirmDelete: async () => {
      if (get().step.type !== 'confirm') return
      const codes = get().entries.map((entry) => entry.code)
      const count = codes.length
      // 收尾动作属于这一次确认: 先取下来, 后面按结果决定调不调
      const onRemoved = get().onRemoved
      set({ step: { type: 'removing' } })
      try {
        const removedCount = await dependencies.stocksRemove(codes)
        if (removedCount === 0) {
          set({
            step: { type: 'error', message: t('dialogRemoveConfirm.allMissing', { count }) },
            onRemoved: undefined,
          })
          return
        }
        onRemoved?.(codes)
        const missingCount = count - removedCount
        if (missingCount > 0) {
          set({
            step: {
              type: 'done',
              message: t('dialogRemoveConfirm.done', { count: removedCount, missing: missingCount }),
            },
            entries: [],
            onRemoved: undefined,
          })
          return
        }
        set({ step: { type: 'idle' }, entries: [], onRemoved: undefined })
      } catch (error) {
        set({
          step: { type: 'error', message: t('dialogRemoveConfirm.failed', { error: errorMessage(error) }) },
          onRemoved: undefined,
        })
      }
    },
  }))
}

export const useDialogRemoveConfirmStore = createDialogRemoveConfirmStore()
