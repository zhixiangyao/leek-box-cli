import { create } from 'zustand'

import { fetchQuotes } from '../api/index.ts'
import type { Quote } from '../api/types.ts'

export const MARKET_INDEX_CODES = ['sh000001', 'sz399001'] as const

type MarketIndexState = {
  indices: Quote[]
  refreshIndices: (signal?: AbortSignal) => Promise<void>
}

export type MarketIndexDependencies = {
  fetchQuotes: typeof fetchQuotes
}

const defaultDependencies: MarketIndexDependencies = { fetchQuotes }

export function createMarketIndexStore(dependencies: MarketIndexDependencies = defaultDependencies) {
  return create<MarketIndexState>()((set) => ({
    indices: [],
    refreshIndices: async (signal?: AbortSignal) => {
      const quotes = await dependencies.fetchQuotes([...MARKET_INDEX_CODES], signal)
      if (signal?.aborted) return

      const byCode = new Map(quotes.map((quote) => [quote.code, quote]))
      const indices = MARKET_INDEX_CODES.flatMap((code) => {
        const quote = byCode.get(code)
        return quote ? [quote] : []
      })
      set({ indices })
    },
  }))
}

export const useMarketIndexStore = createMarketIndexStore()
