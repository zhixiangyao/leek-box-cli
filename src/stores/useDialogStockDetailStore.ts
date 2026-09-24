import { create } from 'zustand'

import { fetchFiveDay, fetchHistorical, fetchIntraday } from '../api/index.ts'
import type { ChartPeriod, ChartPoint, HistoricalRequest, KlinePeriod } from '../api/types.ts'
import { t } from '../i18n/core.ts'
import { errorMessage } from '../lib/error.ts'

const KLINE_REQUEST_BY_PERIOD: Record<KlinePeriod, Omit<HistoricalRequest, 'period' | 'signal'>> = {
  day: { barCount: 60 },
  week: { barCount: 60 },
  month: { barCount: 60 },
  year: { barCount: 30 },
}

const DEFAULT_PERIOD: ChartPeriod = 'intraday'
const isKlinePeriod = (period: ChartPeriod): period is KlinePeriod => period !== 'intraday' && period !== 'five-day'

type DialogStockDetailState = {
  code: string | undefined
  period: ChartPeriod
  status: 'loading' | 'ready' | 'error'
  points: ChartPoint[]
  errorMessage?: string
  open: (code: string) => void
  close: () => void
  setPeriod: (period: ChartPeriod) => void
  refreshChart: (code: string, period: ChartPeriod, signal?: AbortSignal) => Promise<void>
}

export type DialogStockDetailDependencies = {
  fetchIntraday: typeof fetchIntraday
  fetchFiveDay?: typeof fetchFiveDay
  fetchHistorical?: typeof fetchHistorical
}

const defaultDependencies: DialogStockDetailDependencies = { fetchIntraday, fetchFiveDay, fetchHistorical }

export function createDialogStockDetailStore(dependencies: DialogStockDetailDependencies = defaultDependencies) {
  return create<DialogStockDetailState>()((set, get) => {
    const refreshChart = async (code: string, period: ChartPeriod, signal?: AbortSignal) => {
      try {
        let points: ChartPoint[] | undefined
        if (period === 'intraday') {
          points = await dependencies.fetchIntraday(code, signal)
        } else if (period === 'five-day') {
          points = await dependencies.fetchFiveDay?.(code, signal)
        } else if (isKlinePeriod(period)) {
          const request = KLINE_REQUEST_BY_PERIOD[period]
          points = await dependencies.fetchHistorical?.(code, { period, ...request, signal })
        }
        if (!points) {
          const label = period === 'five-day' ? t('chart.period.fiveDay') : t('chart.period.kline')
          throw new Error(t('dialogStockDetail.sourceUnavailable', { period: label }))
        }
        if (get().code !== code || get().period !== period || signal?.aborted) return
        set({ status: 'ready', points, errorMessage: undefined })
      } catch (error) {
        if (get().code !== code || get().period !== period || signal?.aborted) return
        set({ status: 'error', errorMessage: errorMessage(error) })
      }
    }

    return {
      code: undefined,
      period: DEFAULT_PERIOD,
      status: 'loading',
      points: [],
      open: (code) =>
        set({
          code,
          period: DEFAULT_PERIOD,
          status: 'loading',
          points: [],
          errorMessage: undefined,
        }),
      close: () => set({ code: undefined }),
      setPeriod: (period) => {
        if (get().period === period) return
        set({ period, status: 'loading', points: [], errorMessage: undefined })
      },
      refreshChart,
    }
  })
}

export const useDialogStockDetailStore = createDialogStockDetailStore()
