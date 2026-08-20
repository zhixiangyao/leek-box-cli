import { create } from 'zustand'

import { fetchQuotes, type Quote } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'
import { formatClock } from '../lib/format.ts'
import { loadWatchlist, type WatchEntry } from '../lib/watchlist.ts'

export const DEFAULT_POLL_INTERVAL_MS = 5000
export const MIN_POLL_INTERVAL_MS = 1000
export const MAX_POLL_INTERVAL_MS = 60_000
export const POLL_INTERVAL_STEP_MS = 500

export type StockRow =
  | { kind: 'quote'; code: string; name: string; quote: Quote }
  | { kind: 'missing'; code: string; name: string }

export type StockListStep =
  | { type: 'loading' }
  | { type: 'empty' }
  | { type: 'error'; message: string }
  | { type: 'table'; rows: StockRow[]; updatedAt: string; errorLine?: string }

type StockListState = {
  step: StockListStep
  pollIntervalMs: number
  selectedCode: string | null
  scrollOffset: number
  refreshQuotes: (signal?: AbortSignal) => Promise<void>
  moveSelection: (delta: 1 | -1, visible: number) => void
}

export type StockListDependencies = {
  fetchQuotes: (codes: string[], signal?: AbortSignal) => Promise<Quote[]>
  loadWatchlist: () => Promise<WatchEntry[]>
}

const defaultDependencies: StockListDependencies = { fetchQuotes, loadWatchlist }

const clampSelection = (index: number, rowCount: number) => Math.min(Math.max(index, 0), rowCount - 1)

const anchoredScrollOffset = (
  delta: 1 | -1,
  selectedIndex: number,
  rowCount: number,
  scrollOffset: number,
  visible: number,
) => {
  const next = clampSelection(selectedIndex + delta, rowCount)
  const maxOffset = Math.max(0, rowCount - visible)
  if (delta === 1 && next >= scrollOffset + visible) return Math.min(next - visible + 1, maxOffset)
  if (delta === -1 && next < scrollOffset) return next
  return Math.min(scrollOffset, maxOffset)
}

const rowIndex = (rows: StockRow[], code: string | null) => {
  if (!code) return 0
  const index = rows.findIndex((row) => row.code === code)
  return index < 0 ? 0 : index
}

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
  return create<StockListState>()((set, get) => ({
    step: { type: 'loading' },
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    selectedCode: null,
    scrollOffset: 0,

    refreshQuotes: async (signal?: AbortSignal) => {
      try {
        const entries = await dependencies.loadWatchlist()
        if (signal?.aborted) return
        if (entries.length === 0) {
          set({ step: { type: 'empty' }, selectedCode: null, scrollOffset: 0 })
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
              .filter((row): row is Extract<StockRow, { kind: 'quote' }> => row.kind === 'quote')
              .map((row) => [row.code, row.quote]),
          )
          const quoteByCode = new Map(
            fetchedQuotes.map((quote) => {
              const previous = previousQuotes.get(quote.code)
              return [quote.code, previous && quotesEqual(previous, quote) ? previous : quote]
            }),
          )
          const rows: StockRow[] = entries.map((entry) => {
            const quote = quoteByCode.get(entry.code)
            return quote
              ? { kind: 'quote', code: entry.code, name: quote.name, quote }
              : { kind: 'missing', code: entry.code, name: entry.name }
          })
          const updatedAt = formatClock(
            fetchedQuotes.reduce((maximum, quote) => (quote.timestamp > maximum ? quote.timestamp : maximum), ''),
          )
          const previousIndex = rowIndex(previousRows, state.selectedCode)
          const preservedIndex = state.selectedCode ? rows.findIndex((row) => row.code === state.selectedCode) : -1
          const nextIndex = preservedIndex >= 0 ? preservedIndex : clampSelection(previousIndex, rows.length)
          const relativeIndex = Math.max(0, previousIndex - state.scrollOffset)
          return {
            step: { type: 'table', rows, updatedAt },
            selectedCode: rows[nextIndex]?.code ?? null,
            scrollOffset: Math.max(0, nextIndex - relativeIndex),
          }
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

    moveSelection: (delta: 1 | -1, visible: number) => {
      const { step, selectedCode, scrollOffset } = get()
      if (step.type !== 'table' || step.rows.length === 0) return
      const currentIndex = rowIndex(step.rows, selectedCode)
      const nextIndex = clampSelection(currentIndex + delta, step.rows.length)
      set({
        selectedCode: step.rows[nextIndex]?.code ?? null,
        scrollOffset: anchoredScrollOffset(delta, currentIndex, step.rows.length, scrollOffset, visible),
      })
    },
  }))
}

export const useStockListStore = createStockListStore()
