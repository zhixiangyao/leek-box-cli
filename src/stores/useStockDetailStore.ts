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
  refreshIntraday: (code: string) => Promise<void>
}

export const useStockDetailStore = create<StockDetailState>()((set, get) => ({
  stock: null,
  status: 'loading',
  points: [],
  open: (code, name) => set({ stock: { code, name }, status: 'loading', points: [], errorMessage: undefined }),
  close: () => set({ stock: null }),
  refreshIntraday: async (code: string) => {
    try {
      const points = await fetchIntraday(code)
      if (get().stock?.code !== code) return
      set({ status: 'ready', points })
    } catch (err) {
      if (get().stock?.code !== code) return
      set({ status: 'error', errorMessage: errorMessage(err) })
    }
  },
}))
