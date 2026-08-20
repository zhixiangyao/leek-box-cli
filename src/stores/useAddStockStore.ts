import { create } from 'zustand'

import { fetchQuotes, normalizeCode, type Quote } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'
import { addStock, loadWatchlist, type WatchEntry } from '../lib/watchlist.ts'
import { parseYn, YN_ERROR_MESSAGE } from '../lib/yn.ts'

export type AddStockStep =
  | { type: 'input-code' }
  | { type: 'checking'; code: string }
  | { type: 'confirm'; code: string; name: string; current: number }
  | { type: 'saving'; code: string; name: string }
  | { type: 'already-exists'; code: string; name: string }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string }

type InputState = { error: string | null; resetToken: number }

type AddStockState = {
  step: AddStockStep
  codeInput: InputState
  confirmInput: InputState
  reset: () => void
  handleCodeInput: (input: string) => Promise<void>
  handleConfirm: (answer: string) => Promise<void>
}

export type AddStockDependencies = {
  addStock: (entry: WatchEntry) => Promise<{ status: 'added' | 'duplicate' }>
  fetchQuotes: (codes: string[]) => Promise<Quote[]>
  loadWatchlist: () => Promise<WatchEntry[]>
  normalizeCode: (input: string) => string | null
  now: () => string
}

const defaultDependencies: AddStockDependencies = {
  addStock,
  fetchQuotes,
  loadWatchlist,
  normalizeCode,
  now: () => new Date().toISOString(),
}

const FRESH_INPUT: InputState = { error: null, resetToken: 0 }

export function createAddStockStore(dependencies: AddStockDependencies = defaultDependencies) {
  let generation = 0
  const isStale = (value: number) => value !== generation

  return create<AddStockState>()((set, get) => ({
    step: { type: 'input-code' },
    codeInput: FRESH_INPUT,
    confirmInput: FRESH_INPUT,

    reset: () => {
      generation += 1
      set({ step: { type: 'input-code' }, codeInput: FRESH_INPUT, confirmInput: FRESH_INPUT })
    },

    handleCodeInput: async (input: string) => {
      const currentGeneration = generation
      const code = dependencies.normalizeCode(input)
      if (!code) {
        set((state) => ({
          codeInput: {
            error: '无法识别股票代码, 请输入 6 位数字 (如 600000 或 sh600000).',
            resetToken: state.codeInput.resetToken + 1,
          },
        }))
        return
      }
      set((state) => ({ codeInput: { error: null, resetToken: state.codeInput.resetToken + 1 } }))
      set({ step: { type: 'checking', code } })

      try {
        const existing = (await dependencies.loadWatchlist()).find((entry) => entry.code === code)
        if (isStale(currentGeneration)) return
        if (existing) {
          set({ step: { type: 'already-exists', code, name: existing.name } })
          return
        }
        const quote = (await dependencies.fetchQuotes([code]))[0]!
        if (isStale(currentGeneration)) return
        set({ step: { type: 'confirm', code, name: quote.name, current: quote.current } })
      } catch (error) {
        if (!isStale(currentGeneration)) set({ step: { type: 'error', message: errorMessage(error) } })
      }
    },

    handleConfirm: async (answer: string) => {
      const confirmation = parseYn(answer)
      if (!confirmation) {
        set((state) => ({
          confirmInput: { error: YN_ERROR_MESSAGE, resetToken: state.confirmInput.resetToken + 1 },
        }))
        return
      }
      set((state) => ({ confirmInput: { error: null, resetToken: state.confirmInput.resetToken + 1 } }))
      if (confirmation === 'n') {
        set({ step: { type: 'done', message: '已取消.' } })
        return
      }

      const currentGeneration = generation
      const current = get().step
      if (current.type !== 'confirm') return
      set({ step: { type: 'saving', code: current.code, name: current.name } })
      try {
        const result = await dependencies.addStock({
          code: current.code,
          name: current.name,
          addedAt: dependencies.now(),
        })
        if (isStale(currentGeneration)) return
        set({
          step:
            result.status === 'duplicate'
              ? { type: 'already-exists', code: current.code, name: current.name }
              : { type: 'done', message: `已添加 ${current.name} (${current.code}) 到自选股.` },
        })
      } catch (error) {
        if (!isStale(currentGeneration)) {
          set({ step: { type: 'error', message: `写入自选股失败: ${errorMessage(error)}` } })
        }
      }
    },
  }))
}

export const useAddStockStore = createAddStockStore()
