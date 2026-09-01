import { create } from 'zustand'

import { errorMessage } from '../lib/error.ts'
import { loadStocks } from '../settings/file.ts'
import { type StockEntry } from '../settings/schema.ts'

type StockRemoveState = {
  /** 已加载的自选股列表, 交给网格渲染 */
  entries: StockEntry[]
  /** 加载失败时的错误信息, 成功加载后清空 */
  errorMessage: string | undefined
  /** 递增令牌: 变化时网格重新挂载并清空勾选 (取消或删除后重置选择) */
  resetToken: number
  loadEntries: () => Promise<void>
  /** 删除完成后从内存列表移除对应代码, 并重置网格勾选 */
  removeByCodes: (codes: readonly string[]) => void
  /** 仅重置网格勾选 (取消删除时使用) */
  resetSelection: () => void
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

    resetSelection: () => set((state) => ({ resetToken: state.resetToken + 1 })),
  }))
}

export const useStockRemoveStore = createStockRemoveStore()
