import { create } from 'zustand'

import {
  fetchHistorical,
  fetchIntraday,
  type ChartPeriod,
  type ChartPoint,
  type HistoricalPoint,
  type IntradayPoint,
} from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'

const HISTORY_DAYS_BY_PERIOD: Record<ChartPeriod, number | null> = {
  day: null,
  week: 5,
  month: 22,
  'half-year': 120,
  year: 250,
}

const DEFAULT_PERIOD: ChartPeriod = 'day'

const historyDaysFor = (period: ChartPeriod) => HISTORY_DAYS_BY_PERIOD[period]

type StockDetailState = {
  stock: { code: string; name: string } | null
  period: ChartPeriod
  status: 'loading' | 'ready' | 'error'
  points: ChartPoint[]
  errorMessage?: string
  open: (code: string, name: string) => void
  close: () => void
  setPeriod: (period: ChartPeriod) => void
  refreshChart: (code: string, period: ChartPeriod, signal?: AbortSignal) => Promise<void>
}

export type StockDetailDependencies = {
  fetchIntraday: (code: string, signal?: AbortSignal) => Promise<IntradayPoint[]>
  fetchHistorical?: (code: string, tradingDays: number, signal?: AbortSignal) => Promise<HistoricalPoint[]>
}

const defaultDependencies: StockDetailDependencies = { fetchIntraday, fetchHistorical }

export function createStockDetailStore(dependencies: StockDetailDependencies = defaultDependencies) {
  return create<StockDetailState>()((set, get) => {
    const refreshChart = async (code: string, period: ChartPeriod, signal?: AbortSignal) => {
      try {
        const historyDays = historyDaysFor(period)
        const points =
          historyDays === null
            ? await dependencies.fetchIntraday(code, signal)
            : await dependencies.fetchHistorical?.(code, historyDays, signal)
        if (!points) throw new Error('历史行情数据源不可用')
        if (get().stock?.code !== code || get().period !== period || signal?.aborted) return
        set({ status: 'ready', points, errorMessage: undefined })
      } catch (error) {
        if (get().stock?.code !== code || get().period !== period || signal?.aborted) return
        set({ status: 'error', errorMessage: errorMessage(error) })
      }
    }

    return {
      stock: null,
      period: DEFAULT_PERIOD,
      status: 'loading',
      points: [],
      open: (code, name) =>
        set({
          stock: { code, name },
          period: DEFAULT_PERIOD,
          status: 'loading',
          points: [],
          errorMessage: undefined,
        }),
      close: () => set({ stock: null }),
      setPeriod: (period) => {
        if (get().period === period) return
        set({ period, status: 'loading', points: [], errorMessage: undefined })
      },
      refreshChart,
    }
  })
}

export const useStockDetailStore = createStockDetailStore()
