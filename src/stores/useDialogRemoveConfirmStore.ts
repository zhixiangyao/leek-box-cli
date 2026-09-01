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

/** 处于删除确认弹窗 (可取消, 接受 y/n) */
export const isRemoveConfirmStep = (step: DialogRemoveConfirmStep): boolean => step.type === 'confirm'

/** 删除浮层可见 (确认, 正在删除, 删除完成或删除失败): 底层变暗并渲染确认弹窗 */
export const isRemoveOverlayStep = (step: DialogRemoveConfirmStep): boolean =>
  step.type === 'confirm' || step.type === 'removing' || step.type === 'done' || step.type === 'error'

type DialogRemoveConfirmState = {
  step: DialogRemoveConfirmStep
  /** 待删除条目, 由网格提交传入 */
  targets: StockEntry[]
  open: (targets: StockEntry[]) => void
  confirmDelete: () => Promise<void>
  cancel: () => void
  /** 关闭删除完成或删除失败弹窗 (失败时保留网格勾选以便重试) */
  dismiss: () => void
}

export type DialogRemoveConfirmDependencies = {
  stocksRemove: (codes: string[]) => Promise<number>
  /** 删除成功后同步到自选股列表 (默认写入 StockRemove store) */
  commitRemoval: (codes: string[]) => void
  /** 重置网格勾选 (默认作用于 StockRemove store) */
  resetSelection: () => void
}

const defaultDependencies: DialogRemoveConfirmDependencies = {
  stocksRemove,
  commitRemoval: (codes) => useStockRemoveStore.getState().removeByCodes(codes),
  resetSelection: () => useStockRemoveStore.getState().resetSelection(),
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

    cancel: () => {
      if (get().step.type !== 'confirm') return
      set({ step: { type: 'idle' }, targets: [] })
      dependencies.resetSelection()
    },

    dismiss: () => {
      if (get().step.type !== 'done' && get().step.type !== 'error') return
      set({ step: { type: 'idle' }, targets: [] })
    },
  }))
}

export const useDialogRemoveConfirmStore = createDialogRemoveConfirmStore()
