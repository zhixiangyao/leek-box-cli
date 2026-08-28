import { useInput } from 'ink'

import type { ChartPeriod } from '../../../api/types.ts'
import { usePolling } from '../../../hooks/usePolling.ts'
import { useDialogMenuStore } from '../../../stores/useDialogMenuStore.ts'
import { useDialogStockDetailStore } from '../../../stores/useDialogStockDetailStore.ts'
import { useSettingsStore } from '../../../stores/useSettingsStore.ts'
import { useStockListStore } from '../../../stores/useStockListStore.ts'

export const CHART_PERIOD_OPTIONS = [
  { key: '1', value: 'intraday', label: '分时' },
  { key: '2', value: 'five-day', label: '五日' },
  { key: '3', value: 'day', label: '日K' },
  { key: '4', value: 'week', label: '周K' },
  { key: '5', value: 'month', label: '月K' },
  { key: '6', value: 'year', label: '年K' },
] as const satisfies readonly { key: string; value: ChartPeriod; label: string }[]

export function useDialogStockDetail() {
  const stock = useDialogStockDetailStore((state) => state.stock)
  const period = useDialogStockDetailStore((state) => state.period)
  const status = useDialogStockDetailStore((state) => state.status)
  const points = useDialogStockDetailStore((state) => state.points)
  const detailError = useDialogStockDetailStore((state) => state.errorMessage)
  const minuteChartPollIntervalMs = useSettingsStore((state) => state.minuteChartPollIntervalMs)
  const klinePollIntervalMs = useSettingsStore((state) => state.klinePollIntervalMs)
  const menuOpen = useDialogMenuStore((state) => state.open)
  const quote = useStockListStore((state) => {
    if (state.step.type !== 'table') return undefined
    const row = state.step.rows.find((item) => item.code === stock?.code)
    return row?.kind === 'quote' ? row.quote : undefined
  })

  useInput(
    (input, key) => {
      if (key.ctrl) return
      const option = CHART_PERIOD_OPTIONS.find((item) => item.key === input)
      if (option) useDialogStockDetailStore.getState().setPeriod(option.value)
    },
    { isActive: stock !== undefined && !menuOpen },
  )

  usePolling(
    async (signal) => {
      if (stock) await useDialogStockDetailStore.getState().refreshChart(stock.code, period, signal)
    },
    {
      enabled: stock !== undefined,
      intervalMs: period === 'intraday' || period === 'five-day' ? minuteChartPollIntervalMs : klinePollIntervalMs,
      restartKey: stock ? `${stock.code}:${period}` : undefined,
    },
  )

  if (!stock) return undefined

  return {
    stock,
    quote,
    suspended: quote ? quote.current <= 0 : false,
    period,
    status,
    points,
    errorMessage: detailError,
  }
}
