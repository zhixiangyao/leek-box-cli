import { create } from 'zustand'

import { fetchIntraday, type IntradayPoint } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'

export const INTRADAY_POLL_INTERVAL_MS = 30_000

type StockDetailState = {
  stock: { code: string; name: string } | null
  status: 'loading' | 'ready' | 'error'
  points: IntradayPoint[]
  errorMessage?: string
  open: (code: string, name: string) => void
  close: () => void
}

const poll = {
  timer: null as ReturnType<typeof setTimeout> | null,
  inFlight: false,
  cancelled: false,
}

export const useStockDetailStore = create<StockDetailState>()((set, get) => {
  const fetchOnce = async (code: string) => {
    if (poll.inFlight) return
    poll.inFlight = true
    try {
      const points = await fetchIntraday(code)
      if (poll.cancelled || get().stock?.code !== code) return
      set({ status: 'ready', points })
    } catch (err) {
      if (poll.cancelled || get().stock?.code !== code) return
      set({ status: 'error', errorMessage: errorMessage(err) })
    } finally {
      poll.inFlight = false
    }
  }

  const armNext = () => {
    if (poll.cancelled || poll.timer || !get().stock) return
    poll.timer = setTimeout(() => {
      poll.timer = null
      if (poll.cancelled) return
      const { stock } = get()
      if (!stock) return
      void fetchOnce(stock.code).finally(() => {
        if (poll.cancelled) return
        armNext()
      })
    }, INTRADAY_POLL_INTERVAL_MS)
  }

  return {
    stock: null,
    status: 'loading',
    points: [],
    open: (code, name) => {
      poll.cancelled = false
      set({ stock: { code, name }, status: 'loading', points: [], errorMessage: undefined })
      void fetchOnce(code)
      armNext()
    },
    close: () => {
      poll.cancelled = true
      if (poll.timer) clearTimeout(poll.timer)
      poll.timer = null
      set({ stock: null })
    },
  }
})
