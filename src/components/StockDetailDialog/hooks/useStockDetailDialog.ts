import { usePolling } from '../../../hooks/usePolling.ts'
import { useStockDetailStore } from '../../../stores/useStockDetailStore.ts'
import { useStockListStore } from '../../../stores/useStockListStore.ts'

const INTRADAY_POLL_INTERVAL_MS = 30_000

export function useStockDetailDialog() {
  const detailStore = useStockDetailStore()
  const stock = detailStore.stock
  const quote = useStockListStore((state) => {
    if (state.step.type !== 'table') return undefined
    const row = state.step.rows.find((item) => item.code === stock?.code)
    return row?.kind === 'quote' ? row.quote : undefined
  })

  usePolling(
    async (signal) => {
      if (stock) await useStockDetailStore.getState().refreshIntraday(stock.code, signal)
    },
    {
      enabled: stock !== null,
      intervalMs: INTRADAY_POLL_INTERVAL_MS,
      restartKey: stock?.code,
    },
  )

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
