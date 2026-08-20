import { usePolling } from '../../../hooks/usePolling.ts'
import { useStockDetailStore } from '../../../stores/useStockDetailStore.ts'
import { useStockListStore } from '../../../stores/useStockListStore.ts'

const INTRADAY_POLL_INTERVAL_MS = 30_000

export function useStockDetailDialog() {
  const stock = useStockDetailStore((state) => state.stock)
  const status = useStockDetailStore((state) => state.status)
  const points = useStockDetailStore((state) => state.points)
  const detailError = useStockDetailStore((state) => state.errorMessage)
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
  return {
    stock,
    quote,
    suspended: quote ? quote.current <= 0 : false,
    status,
    points,
    errorMessage: detailError,
  }
}
