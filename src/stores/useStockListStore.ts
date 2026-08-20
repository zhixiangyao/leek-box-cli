import { create } from 'zustand'

import { fetchQuotes, type Quote } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'
import { formatClock } from '../lib/format.ts'
import { loadWatchlist } from '../lib/watchlist.ts'

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
  | {
      type: 'table'
      rows: StockRow[]
      updatedAt: string
      errorLine?: string
    }

type StockListState = {
  step: StockListStep
  pollIntervalMs: number
  selectedCode: string | null
  scrollOffset: number
  refreshQuotes: (signal?: AbortSignal) => Promise<void>
  moveSelection: (delta: 1 | -1, visible: number) => void
}

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

const selectedIndex = (rows: StockRow[], code: string | null) => {
  if (!code) return 0
  const index = rows.findIndex((row) => row.code === code)
  return index < 0 ? 0 : index
}

export const useStockListStore = create<StockListState>()((set, get) => ({
  step: { type: 'loading' },
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  selectedCode: null,
  scrollOffset: 0,
  refreshQuotes: async (signal?: AbortSignal) => {
    try {
      const entries = await loadWatchlist()
      if (signal?.aborted) return
      if (entries.length === 0) {
        set({ step: { type: 'empty' }, selectedCode: null, scrollOffset: 0 })
        return
      }
      const quotes = await fetchQuotes(
        entries.map((entry) => entry.code),
        signal,
      )
      if (signal?.aborted) return

      const quoteByCode = new Map(quotes.map((quote) => [quote.code, quote]))
      const rows: StockRow[] = entries.map((entry) => {
        const quote = quoteByCode.get(entry.code)
        return quote
          ? { kind: 'quote', code: entry.code, name: quote.name, quote }
          : { kind: 'missing', code: entry.code, name: entry.name }
      })
      const updatedAt = formatClock(quotes.reduce((max, quote) => (quote.timestamp > max ? quote.timestamp : max), ''))

      set((state) => {
        const previousRows = state.step.type === 'table' ? state.step.rows : []
        const previousIndex = selectedIndex(previousRows, state.selectedCode)
        const preservedIndex = state.selectedCode ? rows.findIndex((row) => row.code === state.selectedCode) : -1
        const nextIndex = preservedIndex >= 0 ? preservedIndex : clampSelection(previousIndex, rows.length)
        const relativeIndex = Math.max(0, previousIndex - state.scrollOffset)
        return {
          step: { type: 'table', rows, updatedAt },
          selectedCode: rows[nextIndex]?.code ?? null,
          scrollOffset: Math.max(0, nextIndex - relativeIndex),
        }
      })
    } catch (err) {
      if (signal?.aborted) return
      const message = errorMessage(err)
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
    const currentIndex = selectedIndex(step.rows, selectedCode)
    const nextIndex = clampSelection(currentIndex + delta, step.rows.length)
    set({
      selectedCode: step.rows[nextIndex]?.code ?? null,
      scrollOffset: anchoredScrollOffset(delta, currentIndex, step.rows.length, scrollOffset, visible),
    })
  },
}))
