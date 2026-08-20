import { useEffect } from 'react'

import { useStockDetailStore } from '../../../stores/useStockDetailStore.ts'
import { useStockListStore } from '../../../stores/useStockListStore.ts'

const INTRADAY_POLL_INTERVAL_MS = 30_000

const poll = {
  timer: null as ReturnType<typeof setTimeout> | null,
  inFlight: false,
  cancelled: false,
}

const pollOnce = async (code: string) => {
  if (poll.inFlight) return
  poll.inFlight = true
  try {
    await useStockDetailStore.getState().refreshIntraday(code)
  } finally {
    poll.inFlight = false
  }
}

const armNext = () => {
  if (poll.cancelled || poll.timer) return
  const { stock } = useStockDetailStore.getState()
  if (!stock) return
  poll.timer = setTimeout(() => {
    poll.timer = null
    if (poll.cancelled) return
    void pollOnce(stock.code).finally(() => {
      if (poll.cancelled) return
      armNext()
    })
  }, INTRADAY_POLL_INTERVAL_MS)
}

export function useStockDetailDialog() {
  const detailStore = useStockDetailStore()
  const stock = detailStore.stock
  const quote = useStockListStore((state) =>
    state.step.type === 'table' ? state.step.quotes.find((q) => q.code === stock?.code) : undefined,
  )

  useEffect(() => {
    if (!stock) {
      poll.cancelled = true
      if (poll.timer) clearTimeout(poll.timer)
      poll.timer = null
      return
    }
    poll.cancelled = false
    void pollOnce(stock.code)
    armNext()
    return () => {
      poll.cancelled = true
      if (poll.timer) clearTimeout(poll.timer)
      poll.timer = null
    }
  }, [stock])

  if (!stock) return null
  const suspended = !quote ? false : quote.current <= 0
  return {
    stock,
    quote,
    suspended,
    status: detailStore.status,
    points: detailStore.points,
    errorMessage: detailStore.errorMessage,
  }
}
