import { create } from 'zustand'

import { fetchQuotes, normalizeCode, type Quote } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'
import { stocksAdd, type StockEntry } from '../lib/settings.ts'
import { parseYn, YN_ERROR_MESSAGE } from '../lib/yn.ts'

type StockCandidate = Pick<StockEntry, 'code' | 'name'> & { current: number }

export type StockAddStep =
  | { type: 'input-code' }
  | { type: 'checking'; codes: string[] }
  | { type: 'confirm'; entries: StockCandidate[] }
  | { type: 'saving'; entries: StockCandidate[] }
  | { type: 'already-exists'; entries: StockCandidate[] }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string }

type InputState = { error: string | undefined; resetToken: number }

type StockAddState = {
  step: StockAddStep
  codeInput: InputState
  confirmInput: InputState
  reset: () => void
  handleCodeInput: (input: string) => Promise<void>
  handleConfirm: (answer: string) => Promise<void>
}

export type StockAddDependencies = {
  stocksAdd: (entries: StockEntry[]) => Promise<number>
  fetchQuotes: (codes: string[]) => Promise<Quote[]>
  normalizeCode: (input: string) => string | undefined
  now: () => string
}

const defaultDependencies: StockAddDependencies = {
  stocksAdd,
  fetchQuotes,
  normalizeCode,
  now: () => new Date().toISOString(),
}

const FRESH_INPUT: InputState = { error: undefined, resetToken: 0 }

const invalidCodeInput = (
  set: (partial: Partial<StockAddState> | ((state: StockAddState) => Partial<StockAddState>)) => void,
) => {
  set((state) => ({
    codeInput: {
      error: '无法识别股票代码, 请用英文逗号分隔 6 位股票代码.',
      resetToken: state.codeInput.resetToken + 1,
    },
  }))
}

export function createStockAddStore(dependencies: StockAddDependencies = defaultDependencies) {
  let generation = 0
  const isStale = (value: number) => value !== generation

  return create<StockAddState>()((set, get) => ({
    step: { type: 'input-code' },
    codeInput: FRESH_INPUT,
    confirmInput: FRESH_INPUT,

    reset: () => {
      generation += 1
      set({ step: { type: 'input-code' }, codeInput: FRESH_INPUT, confirmInput: FRESH_INPUT })
    },

    handleCodeInput: async (input: string) => {
      const currentGeneration = generation
      const rawCodes = input.split(',').map((value) => value.trim())
      if (rawCodes.length === 0 || rawCodes.some((value) => value === '')) {
        invalidCodeInput(set)
        return
      }

      const normalizedCodes = rawCodes.map((value) => dependencies.normalizeCode(value))
      if (normalizedCodes.some((code) => code === undefined)) {
        invalidCodeInput(set)
        return
      }
      const codes = [...new Set(normalizedCodes)] as string[]

      set((state) => ({ codeInput: { error: undefined, resetToken: state.codeInput.resetToken + 1 } }))
      set({ step: { type: 'checking', codes } })

      try {
        const quotes = await dependencies.fetchQuotes(codes)
        if (isStale(currentGeneration)) return
        const quotesByCode = new Map(quotes.map((quote) => [quote.code, quote]))
        const missingCodes = codes.filter((code) => !quotesByCode.has(code))
        if (missingCodes.length > 0) {
          set({ step: { type: 'error', message: `未找到股票代码: ${missingCodes.join(', ')}.` } })
          return
        }

        const entries = codes.map((code) => {
          const quote = quotesByCode.get(code)!
          return { code, name: quote.name, current: quote.current }
        })
        set({ step: { type: 'confirm', entries } })
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
      set((state) => ({ confirmInput: { error: undefined, resetToken: state.confirmInput.resetToken + 1 } }))
      if (confirmation === 'n') {
        set({ step: { type: 'done', message: '已取消.' } })
        return
      }

      const currentGeneration = generation
      const current = get().step
      if (current.type !== 'confirm') return
      set({ step: { type: 'saving', entries: current.entries } })
      try {
        const addedAt = dependencies.now()
        const addedCount = await dependencies.stocksAdd(
          current.entries.map((entry) => ({
            code: entry.code,
            name: entry.name,
            addedAt,
          })),
        )
        if (isStale(currentGeneration)) return
        if (addedCount === 0) {
          set({ step: { type: 'already-exists', entries: current.entries } })
          return
        }

        const existingCount = current.entries.length - addedCount
        set({
          step: {
            type: 'done',
            message: `已添加 ${addedCount} 个股票, ${existingCount} 个已在自选股中.`,
          },
        })
      } catch (error) {
        if (!isStale(currentGeneration)) {
          set({ step: { type: 'error', message: `写入自选股失败: ${errorMessage(error)}` } })
        }
      }
    },
  }))
}

export const useStockAddStore = createStockAddStore()
