import { create } from 'zustand'

import { fetchQuoteNames } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'
import { loadStocks } from '../settings/file.ts'

/** 删除网格的条目: 比 StockEntry 多一个名称, 名称来自实时行情而非文件 */
export type StockRemoveEntry = { code: string; name: string | undefined }

type StockRemoveState = {
  entries: StockRemoveEntry[]
  errorMessage: string | undefined
  resetToken: number
  loadEntries: () => Promise<void>
  removeByCodes: (codes: readonly string[]) => void
}

export type StockRemoveDependencies = {
  loadStocks: typeof loadStocks
  fetchQuoteNames: typeof fetchQuoteNames
}

const defaultDependencies: StockRemoveDependencies = { loadStocks, fetchQuoteNames }

export function createStockRemoveStore(dependencies: StockRemoveDependencies = defaultDependencies) {
  // 加载代数: 离开删除页再进来会重开一轮, 上一轮 (可能已卡在超时边缘) 的结果不落地
  let generation = 0
  const isStale = (value: number) => value !== generation

  return create<StockRemoveState>()((set) => ({
    entries: [],
    errorMessage: undefined,
    resetToken: 0,
    loadEntries: async () => {
      const currentGeneration = ++generation
      set({ entries: [], errorMessage: undefined })
      try {
        const stocks = await dependencies.loadStocks()
        if (isStale(currentGeneration)) return
        const codes = stocks.map(({ code }) => code)
        // 先按文件里的代码铺出网格 (勾选不必等行情), 名称到了再补
        set({ entries: stocks.map(({ code }) => ({ code, name: undefined })) })
        const fetchedQuoteNames = await dependencies.fetchQuoteNames(codes)
        if (isStale(currentGeneration)) return
        const nameByCode = new Map(fetchedQuoteNames)
        set((state) => ({ entries: state.entries.map(({ code }) => ({ code, name: nameByCode.get(code) })) }))
      } catch (error) {
        if (isStale(currentGeneration)) return
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
