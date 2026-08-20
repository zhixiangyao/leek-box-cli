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

type InputState = { error: string | null; key: number }

type RemoveStockState = {
  step: RemoveStockStep
  indexInput: InputState
  confirmInput: InputState
  loadEntries: () => void
  handleChoice: (choice: string) => void
  handleConfirm: (answer: string) => void
}

let generation = 0
const isStale = (gen: number) => gen !== generation

const FRESH_INPUT: InputState = { error: null, key: 0 }

export const useRemoveStockStore = create<RemoveStockState>()((set, get) => ({
  step: { type: 'loading' },
  indexInput: FRESH_INPUT,
  confirmInput: FRESH_INPUT,

  loadEntries: async () => {
    const gen = ++generation
    set({ step: { type: 'loading' }, indexInput: FRESH_INPUT, confirmInput: FRESH_INPUT })
    try {
      const entries = await loadWatchlist()
      if (isStale(gen)) return
      set({
        step:
          entries.length === 0 ? { type: 'error', message: '自选股为空, 请先添加股票.' } : { type: 'select', entries },
      })
    } catch (err) {
      if (isStale(gen)) return
      set({ step: { type: 'error', message: errorMessage(err) } })
    }
  },

  handleChoice: (choice: string) => {
    const current = get().step
    if (current.type !== 'select') return
    const index = Number(choice.trim())
    if (!Number.isInteger(index) || index < 1 || index > current.entries.length) {
      set((state) => ({
        indexInput: { error: `无效的序号, 请输入 1-${current.entries.length}`, key: state.indexInput.key + 1 },
      }))
      return
    }
    set((state) => ({ indexInput: { error: null, key: state.indexInput.key + 1 } }))
    set({ step: { type: 'confirm', entry: current.entries[index - 1]! } })
  },

  handleConfirm: (answer: string) => {
    const yn = parseYn(answer)
    if (!yn) {
      set((state) => ({ confirmInput: { error: YN_ERROR_MESSAGE, key: state.confirmInput.key + 1 } }))
      return
    }
    set((state) => ({ confirmInput: { error: null, key: state.confirmInput.key + 1 } }))
    if (yn === 'n') {
      set({ step: { type: 'done', message: '已取消.' } })
      return
    }

    const gen = generation
    const current = get().step
    if (current.type !== 'confirm') return
    void (async () => {
      try {
        await removeStock(current.entry.code)
        if (isStale(gen)) return
        set({ step: { type: 'done', message: `已删除 ${current.entry.name} (${current.entry.code}).` } })
      } catch (err) {
        if (isStale(gen)) return
        set({ step: { type: 'error', message: `删除失败: ${errorMessage(err)}` } })
      }
    })()
  },
}))
