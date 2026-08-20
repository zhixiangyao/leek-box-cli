import { create } from 'zustand'

import { fetchIntraday, type IntradayPoint } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'

type StockDetailState = {
  stock: { code: string; name: string } | null
  status: 'loading' | 'ready' | 'error'
  points: IntradayPoint[]
  errorMessage?: string
  open: (code: string, name: string) => void
  close: () => void
  refreshIntraday: (code: string, signal?: AbortSignal) => Promise<void>
}

export type StockDetailDependencies = {
  fetchIntraday: (code: string, signal?: AbortSignal) => Promise<IntradayPoint[]>
}

const defaultDependencies: StockDetailDependencies = { fetchIntraday }

export function createStockDetailStore(dependencies: StockDetailDependencies = defaultDependencies) {
  return create<StockDetailState>()((set, get) => ({
    stock: null,
    status: 'loading',
    points: [],
    open: (code, name) => set({ stock: { code, name }, status: 'loading', points: [], errorMessage: undefined }),
    close: () => set({ stock: null }),
    refreshIntraday: async (code: string, signal?: AbortSignal) => {
      try {
        const points = await dependencies.fetchIntraday(code, signal)
        if (get().stock?.code !== code || signal?.aborted) return
        set({ status: 'ready', points, errorMessage: undefined })
      } catch (error) {
        if (get().stock?.code !== code || signal?.aborted) return
        set({ status: 'error', errorMessage: errorMessage(error) })
      }
    },
  }))
}

export const useStockDetailStore = createStockDetailStore()
