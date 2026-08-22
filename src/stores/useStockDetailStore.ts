import { create } from 'zustand'

import {
  fetchFiveDay,
  fetchHistorical,
  fetchIntraday,
  type ChartPeriod,
  type ChartPoint,
  type FiveDayPoint,
  type HistoricalPoint,
  type HistoricalRequest,
  type IntradayPoint,
  type KlinePeriod,
} from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'

const KLINE_REQUEST_BY_PERIOD: Record<KlinePeriod, Omit<HistoricalRequest, 'period' | 'signal'>> = {
  day: { barCount: 60 },
  week: { barCount: 60 },
  month: { barCount: 60 },
  year: { barCount: 30 },
}

const DEFAULT_PERIOD: ChartPeriod = 'intraday'
const isKlinePeriod = (period: ChartPeriod): period is KlinePeriod => period !== 'intraday' && period !== 'five-day'

type StockDetailState = {
  stock: { code: string; name: string } | undefined
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
  fetchFiveDay?: (code: string, signal?: AbortSignal) => Promise<FiveDayPoint[]>
  fetchHistorical?: (code: string, request: HistoricalRequest) => Promise<HistoricalPoint[]>
}

const defaultDependencies: StockDetailDependencies = { fetchIntraday, fetchFiveDay, fetchHistorical }

export function createStockDetailStore(dependencies: StockDetailDependencies = defaultDependencies) {
  return create<StockDetailState>()((set, get) => {
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
        if (!points) throw new Error(`${period === 'five-day' ? '五日' : 'K 线'}行情数据源不可用`)
        if (get().stock?.code !== code || get().period !== period || signal?.aborted) return
        set({ status: 'ready', points, errorMessage: undefined })
      } catch (error) {
        if (get().stock?.code !== code || get().period !== period || signal?.aborted) return
        set({ status: 'error', errorMessage: errorMessage(error) })
      }
    }

    return {
      stock: undefined,
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
      close: () => set({ stock: undefined }),
      setPeriod: (period) => {
        if (get().period === period) return
        set({ period, status: 'loading', points: [], errorMessage: undefined })
      },
      refreshChart,
    }
  })
}

export const useStockDetailStore = createStockDetailStore()
