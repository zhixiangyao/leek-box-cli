import { create } from 'zustand'

import { fetchQuotes, normalizeCode } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'
import { addStock, loadWatchlist } from '../lib/watchlist.ts'
import { parseYn, YN_ERROR_MESSAGE } from '../lib/yn.ts'

export type AddStockStep =
  | { type: 'input-code' }
  | { type: 'checking'; code: string }
  | { type: 'confirm'; code: string; name: string; current: number }
  | { type: 'already-exists'; code: string; name: string }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string }

type InputState = { error: string | null; key: number }

type AddStockState = {
  step: AddStockStep
  codeInput: InputState
  confirmInput: InputState
  reset: () => void
  handleCodeInput: (input: string) => void
  handleConfirm: (answer: string) => void
}

let generation = 0
const isStale = (gen: number) => gen !== generation

const FRESH_INPUT: InputState = { error: null, key: 0 }

export const useAddStockStore = create<AddStockState>()((set, get) => ({
  step: { type: 'input-code' },
  codeInput: FRESH_INPUT,
  confirmInput: FRESH_INPUT,

  reset: () => {
    generation += 1
    set({ step: { type: 'input-code' }, codeInput: FRESH_INPUT, confirmInput: FRESH_INPUT })
  },

  handleCodeInput: async (input: string) => {
    const gen = generation
    const code = normalizeCode(input)
    if (!code) {
      set((state) => ({
        codeInput: {
          error: '无法识别股票代码, 请输入 6 位数字 (如 600000 或 sh600000).',
          key: state.codeInput.key + 1,
        },
      }))
      return
    }
    set((state) => ({ codeInput: { error: null, key: state.codeInput.key + 1 } }))
    set({ step: { type: 'checking', code } })

    try {
      const existing = (await loadWatchlist()).find((entry) => entry.code === code)
      if (isStale(gen)) return
      if (existing) {
        set({ step: { type: 'already-exists', code, name: existing.name } })
        return
      }
      const quotes = await fetchQuotes([code])
      if (isStale(gen)) return
      const quote = quotes[0]!
      set({ step: { type: 'confirm', code, name: quote.name, current: quote.current } })
    } catch (err) {
      if (isStale(gen)) return
      set({ step: { type: 'error', message: errorMessage(err) } })
    }
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
        await addStock({ code: current.code, name: current.name, addedAt: new Date().toISOString() })
        if (isStale(gen)) return
        set({ step: { type: 'done', message: `已添加 ${current.name} (${current.code}) 到自选股.` } })
      } catch (err) {
        if (isStale(gen)) return
        set({ step: { type: 'error', message: `写入自选股失败: ${errorMessage(err)}` } })
      }
    })()
  },
}))
