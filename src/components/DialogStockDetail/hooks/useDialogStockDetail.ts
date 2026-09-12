import { useInput } from 'ink'

import type { ChartPeriod } from '../../../api/types.ts'
import { usePolling } from '../../../hooks/usePolling.ts'
import type { MessageKey } from '../../../i18n/types.ts'
import { useDialogStockDetailStore } from '../../../stores/useDialogStockDetailStore.ts'
import { useSettingsStore } from '../../../stores/useSettingsStore.ts'
import { useStockListStore } from '../../../stores/useStockListStore.ts'

export const CHART_PERIOD_OPTIONS = [
  { key: '1', value: 'intraday', labelKey: 'chart.period.intraday' },
  { key: '2', value: 'five-day', labelKey: 'chart.period.fiveDay' },
  { key: '3', value: 'day', labelKey: 'chart.period.day' },
  { key: '4', value: 'week', labelKey: 'chart.period.week' },
  { key: '5', value: 'month', labelKey: 'chart.period.month' },
  { key: '6', value: 'year', labelKey: 'chart.period.year' },
] satisfies { key: string; value: ChartPeriod; labelKey: MessageKey }[]

const CHART_PERIOD_MAP = CHART_PERIOD_OPTIONS.reduce<Record<string, ChartPeriod>>(
  (acc, cur) => ((acc[cur.key] = cur.value), acc),
  {},
)

export function useDialogStockDetail() {
  const stock = useDialogStockDetailStore((state) => state.stock)
  const period = useDialogStockDetailStore((state) => state.period)
  const status = useDialogStockDetailStore((state) => state.status)
  const points = useDialogStockDetailStore((state) => state.points)
  const detailError = useDialogStockDetailStore((state) => state.errorMessage)
  const close = useDialogStockDetailStore((state) => state.close)
  const setPeriod = useDialogStockDetailStore((state) => state.setPeriod)
  const refreshChart = useDialogStockDetailStore((state) => state.refreshChart)
  const minuteChartPollIntervalMs = useSettingsStore((state) => state.minuteChartPollIntervalMs)
  const klinePollIntervalMs = useSettingsStore((state) => state.klinePollIntervalMs)
  const quote = useStockListStore((state) => {
    if (state.step.type !== 'table') return undefined
    const row = state.step.rows.find((item) => item.code === stock?.code)
    return row?.kind === 'quote' ? row.quote : undefined
  })

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (key.escape) close()
      else {
        const period = CHART_PERIOD_MAP[input]
        if (period) setPeriod(period)
      }
    },
    { isActive: stock !== undefined },
  )

  usePolling(
    async (signal) => {
      if (stock) await refreshChart(stock.code, period, signal)
    },
    {
      enabled: stock !== undefined,
      intervalMs: ['intraday', 'five-day'].includes(period) ? minuteChartPollIntervalMs : klinePollIntervalMs,
      restartKey: stock ? `${stock.code}:${period}` : undefined,
    },
  )

  return {
    stock,
    quote,
    suspended: quote ? quote.current <= 0 : false,
    period,
    status,
    points,
    detailError,
  }
}
