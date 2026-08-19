import { create } from 'zustand'

import { errorMessage } from '../lib/error.ts'
import { loadWatchlist, removeStock, type WatchEntry } from '../lib/watchlist.ts'
import { parseYn, YN_ERROR_MESSAGE } from '../lib/yn.ts'

export type RemoveStockStep =
  | { type: 'loading' }
  | { type: 'select'; entries: WatchEntry[] }
  | { type: 'confirm'; entry: WatchEntry }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string }

type RemoveStockState = {
  step: RemoveStockStep
  indexInputError: string | null
  indexInputKey: number
  confirmInputError: string | null
  confirmInputKey: number
  /** 进入页面时加载自选股列表 (store 常驻, 每次进入重新加载并复位输入状态) */
  load: () => void
  handleChoice: (choice: string) => void
  handleConfirm: (answer: string) => void
}

// 流程代数: 离开页面后, 进行中的异步请求结果会被丢弃, 避免旧响应污染新流程
let flowSeq = 0

export const useRemoveStockStore = create<RemoveStockState>()((set, get) => ({
  step: { type: 'loading' },
  indexInputError: null,
  indexInputKey: 0,
  confirmInputError: null,
  confirmInputKey: 0,

  load: async () => {
    const seq = ++flowSeq
    set({
      step: { type: 'loading' },
      indexInputError: null,
      indexInputKey: 0,
      confirmInputError: null,
      confirmInputKey: 0,
    })
    try {
      const entries = await loadWatchlist()
      if (seq !== flowSeq) return
      if (entries.length === 0) {
        set({ step: { type: 'error', message: '自选股为空, 请先添加股票.' } })
      } else {
        set({ step: { type: 'select', entries } })
      }
    } catch (err) {
      if (seq !== flowSeq) return
      set({ step: { type: 'error', message: errorMessage(err) } })
    }
  },

  handleChoice: (choice: string) => {
    const current = get().step
    if (current.type !== 'select') return
    const index = Number(choice.trim())
    if (!Number.isInteger(index) || index < 1 || index > current.entries.length) {
      set((state) => ({
        indexInputError: `无效的序号, 请输入 1-${current.entries.length}`,
        indexInputKey: state.indexInputKey + 1,
      }))
      return
    }
    set((state) => ({ indexInputError: null, indexInputKey: state.indexInputKey + 1 }))
    set({ step: { type: 'confirm', entry: current.entries[index - 1]! } })
  },

  handleConfirm: (answer: string) => {
    const yn = parseYn(answer)
    if (!yn) {
      set((state) => ({ confirmInputError: YN_ERROR_MESSAGE, confirmInputKey: state.confirmInputKey + 1 }))
      return
    }
    set((state) => ({ confirmInputError: null, confirmInputKey: state.confirmInputKey + 1 }))
    if (yn === 'n') {
      set({ step: { type: 'done', message: '已取消.' } })
      return
    }

    const seq = flowSeq
    const current = get().step
    if (current.type !== 'confirm') return
    void (async () => {
      try {
        await removeStock(current.entry.code)
        if (seq !== flowSeq) return
        set({ step: { type: 'done', message: `已删除 ${current.entry.name} (${current.entry.code}).` } })
      } catch (err) {
        if (seq !== flowSeq) return
        set({ step: { type: 'error', message: `删除失败: ${errorMessage(err)}` } })
      }
    })()
  },
}))
