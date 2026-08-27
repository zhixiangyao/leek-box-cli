import { create } from 'zustand'

import { errorMessage } from '../lib/error.ts'
import { loadStocks, stockRemove, type StockEntry } from '../lib/settings.ts'
import { parseYn, YN_ERROR_MESSAGE } from '../lib/yn.ts'

export type StockRemoveStep =
  | { type: 'loading' }
  | { type: 'select'; entries: StockEntry[] }
  | { type: 'confirm'; entry: StockEntry }
  | { type: 'removing'; entry: StockEntry }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string }

type InputState = { error: string | undefined; resetToken: number }

type StockRemoveState = {
  step: StockRemoveStep
  indexInput: InputState
  confirmInput: InputState
  loadEntries: () => Promise<void>
  handleChoice: (choice: string) => void
  handleConfirm: (answer: string) => Promise<void>
}

export type StockRemoveDependencies = {
  loadStocks: () => Promise<StockEntry[]>
  stockRemove: (code: string) => Promise<StockEntry | undefined>
}

const defaultDependencies: StockRemoveDependencies = { loadStocks, stockRemove }
const FRESH_INPUT: InputState = { error: undefined, resetToken: 0 }

export function createStockRemoveStore(dependencies: StockRemoveDependencies = defaultDependencies) {
  let generation = 0
  const isStale = (value: number) => value !== generation

  return create<StockRemoveState>()((set, get) => ({
    step: { type: 'loading' },
    indexInput: FRESH_INPUT,
    confirmInput: FRESH_INPUT,

    loadEntries: async () => {
      const currentGeneration = ++generation
      set({ step: { type: 'loading' }, indexInput: FRESH_INPUT, confirmInput: FRESH_INPUT })
      try {
        const entries = await dependencies.loadStocks()
        if (isStale(currentGeneration)) return
        set({
          step:
            entries.length === 0
              ? { type: 'error', message: '自选股为空, 请先添加股票.' }
              : { type: 'select', entries },
        })
      } catch (error) {
        if (!isStale(currentGeneration)) set({ step: { type: 'error', message: errorMessage(error) } })
      }
    },

    handleChoice: (choice: string) => {
      const current = get().step
      if (current.type !== 'select') return
      const index = Number(choice.trim())
      if (!Number.isInteger(index) || index < 1 || index > current.entries.length) {
        set((state) => ({
          indexInput: {
            error: `无效的序号, 请输入 1-${current.entries.length}`,
            resetToken: state.indexInput.resetToken + 1,
          },
        }))
        return
      }
      set((state) => ({ indexInput: { error: undefined, resetToken: state.indexInput.resetToken + 1 } }))
      set({ step: { type: 'confirm', entry: current.entries[index - 1]! } })
    },

    handleConfirm: async (answer: string) => {
      const confirmation = parseYn(answer)
      if (!confirmation) {
        set((state) => ({
          confirmInput: { error: YN_ERROR_MESSAGE, resetToken: state.confirmInput.resetToken + 1 },
        }))
        return
      }
      set((state) => ({ confirmInput: { error: undefined, resetToken: state.confirmInput.resetToken + 1 } }))
      if (confirmation === 'n') {
        set({ step: { type: 'done', message: '已取消.' } })
        return
      }

      const currentGeneration = generation
      const current = get().step
      if (current.type !== 'confirm') return
      set({ step: { type: 'removing', entry: current.entry } })
      try {
        const removed = await dependencies.stockRemove(current.entry.code)
        if (isStale(currentGeneration)) return
        set({
          step: removed
            ? { type: 'done', message: `已删除 ${current.entry.name} (${current.entry.code}).` }
            : { type: 'error', message: `${current.entry.name} (${current.entry.code}) 已不在自选股中.` },
        })
      } catch (error) {
        if (!isStale(currentGeneration)) {
          set({ step: { type: 'error', message: `删除失败: ${errorMessage(error)}` } })
        }
      }
    },
  }))
}

export const useStockRemoveStore = createStockRemoveStore()
