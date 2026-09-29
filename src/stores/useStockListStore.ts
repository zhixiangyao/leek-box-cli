import { create } from 'zustand'

import { fetchQuotes } from '../api/index.ts'
import type { Quote } from '../api/types.ts'
import { errorMessage } from '../lib/error.ts'
import { loadStocks } from '../settings/file.ts'

export type StockListRow = { kind: 'quote'; code: string; quote: Quote } | { kind: 'missing'; code: string }

export type StockListStep =
  | { type: 'loading' }
  | { type: 'empty' }
  | { type: 'error'; message: string }
  | { type: 'table'; rows: StockListRow[]; errorLine?: string }

type StockListState = {
  step: StockListStep
  refreshQuotes: (signal?: AbortSignal) => Promise<void>
  reset: () => void
}

export type StockListDependencies = {
  fetchQuotes: typeof fetchQuotes
  loadStocks: typeof loadStocks
}

const defaultDependencies: StockListDependencies = { fetchQuotes, loadStocks }

const quotesEqual = (left: Quote, right: Quote) =>
  left.code === right.code &&
  left.name === right.name &&
  left.current === right.current &&
  left.prevClose === right.prevClose &&
  left.open === right.open &&
  left.high === right.high &&
  left.low === right.low &&
  left.change === right.change &&
  left.changePercent === right.changePercent &&
  left.timestamp === right.timestamp &&
  left.volume === right.volume &&
  left.turnover === right.turnover &&
  left.turnoverRate === right.turnoverRate &&
  left.amplitude === right.amplitude &&
  left.marketCap === right.marketCap &&
  left.volumeRatio === right.volumeRatio

export function createStockListStore(dependencies: StockListDependencies = defaultDependencies) {
  return create<StockListState>()((set) => ({
    step: { type: 'loading' },
    refreshQuotes: async (signal?: AbortSignal) => {
      try {
        const entries = await dependencies.loadStocks()
        if (signal?.aborted) return
        if (entries.length === 0) {
          set({ step: { type: 'empty' } })
          return
        }
        const fetchedQuotes = await dependencies.fetchQuotes(
          entries.map((entry) => entry.code),
          signal,
        )
        if (signal?.aborted) return

        set((state) => {
          const previousRows = state.step.type === 'table' ? state.step.rows : []
          const previousQuotes = new Map(
            previousRows
              .filter((row): row is Extract<StockListRow, { kind: 'quote' }> => row.kind === 'quote')
              .map((row) => [row.code, row.quote]),
          )
          const quoteByCode = new Map(
            fetchedQuotes.map((quote) => {
              const previous = previousQuotes.get(quote.code)
              return [quote.code, previous && quotesEqual(previous, quote) ? previous : quote]
            }),
          )
          const rows = entries.map<StockListRow>((entry) => {
            const quote = quoteByCode.get(entry.code)
            return quote ? { kind: 'quote', code: entry.code, quote } : { kind: 'missing', code: entry.code }
          })
          return { step: { type: 'table', rows } }
        })
      } catch (error) {
        if (signal?.aborted) return
        const message = errorMessage(error)
        set((state) =>
          state.step.type === 'table'
            ? { step: { ...state.step, errorLine: message } }
            : { step: { type: 'error', message } },
        )
      }
    },
    reset: () => {
      set({ step: { type: 'loading' } })
    },
  }))
}

export const useStockListStore = createStockListStore()
