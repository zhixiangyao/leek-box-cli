import { create } from 'zustand'

import { fetchQuotes, type Quote } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'
import { formatClock } from '../lib/format.ts'
import { loadWatchlist } from '../lib/watchlist.ts'

export const DEFAULT_POLL_INTERVAL_MS = 5000
export const MIN_POLL_INTERVAL_MS = 1000
export const MAX_POLL_INTERVAL_MS = 60_000
export const POLL_INTERVAL_STEP_MS = 500

export type StockListStep =
  | { type: 'loading' }
  | { type: 'empty' }
  | { type: 'error'; message: string }
  | {
      type: 'table'
      quotes: Quote[]
      missing: { code: string; name: string }[]
      updatedAt: string
      errorLine?: string
    }

type StockListState = {
  step: StockListStep
  pollIntervalMs: number
  selectedIndex: number
  scrollOffset: number
  refreshQuotes: () => Promise<void>
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

export const useStockListStore = create<StockListState>()((set, get) => ({
  step: { type: 'loading' },
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  selectedIndex: 0,
  scrollOffset: 0,
  refreshQuotes: async () => {
    try {
      const entries = await loadWatchlist()
      if (entries.length === 0) {
        set({ step: { type: 'empty' } })
        return
      }
      const quotes = await fetchQuotes(entries.map((entry) => entry.code))
      const quoteCodes = new Set(quotes.map((quote) => quote.code))
      const missing = entries
        .filter((entry) => !quoteCodes.has(entry.code))
        .map((entry) => ({ code: entry.code, name: entry.name }))
      const updatedAt = formatClock(quotes.reduce((max, quote) => (quote.timestamp > max ? quote.timestamp : max), ''))
      set({ step: { type: 'table', quotes, missing, updatedAt } })
    } catch (err) {
      const message = errorMessage(err)
      set((state) =>
        state.step.type === 'table'
          ? { step: { ...state.step, errorLine: message } }
          : { step: { type: 'error', message } },
      )
    }
  },
  moveSelection: (delta: 1 | -1, visible: number) => {
    const { step, selectedIndex, scrollOffset } = get()
    if (step.type !== 'table') return
    const rowCount = step.quotes.length + step.missing.length
    if (rowCount === 0) return
    set({
      selectedIndex: clampSelection(selectedIndex + delta, rowCount),
      scrollOffset: anchoredScrollOffset(delta, selectedIndex, rowCount, scrollOffset, visible),
    })
  },
}))
