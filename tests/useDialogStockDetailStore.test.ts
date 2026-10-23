import { expect, test } from 'vitest'

import type { FiveDayPoint, HistoricalPoint, IntradayPoint } from '../src/api/types.ts'
import { createDialogStockDetailStore } from '../src/stores/useDialogStockDetailStore.ts'

test('股票详情忽略先前打开代码已完成的请求', async () => {
  let resolveOld: (points: IntradayPoint[]) => void = () => undefined
  const oldRequest = new Promise<IntradayPoint[]>((resolve) => {
    resolveOld = resolve
  })
  const newPoints = [{ time: '0930', price: 12, volume: 10 }]
  const store = createDialogStockDetailStore({
    fetchIntraday: async (code) => (code === 'sh600000' ? oldRequest : newPoints),
    fetchFiveDay: async () => [],
    fetchHistorical: async () => [],
  })

  store.getState().open('sh600000')
  const pendingOld = store.getState().refreshChart('sh600000', 'intraday')
  store.getState().open('sz000001')
  await store.getState().refreshChart('sz000001', 'intraday')
  resolveOld([{ time: '0930', price: 10, volume: 1 }])
  await pendingOld

  expect(store.getState().points).toStrictEqual(newPoints)
  expect(store.getState().code).toBe('sz000001')
})

test('五日与 K 线按周期调用各自的依赖', async () => {
  const fiveDayPoints: FiveDayPoint[] = [
    { time: '0930', price: 10, volume: 10, sessionDate: '2026-10-23', prevClose: 9.9 },
  ]
  const historicalPoints: HistoricalPoint[] = [
    { date: '2026-10-23', open: 10, high: 11, low: 9.5, close: 10.5, volume: 100 },
  ]
  const store = createDialogStockDetailStore({
    fetchIntraday: async () => [],
    fetchFiveDay: async () => fiveDayPoints,
    fetchHistorical: async () => historicalPoints,
  })

  store.getState().open('sh600000')
  store.getState().setPeriod('five-day')
  await store.getState().refreshChart('sh600000', 'five-day')
  expect(store.getState().points).toStrictEqual(fiveDayPoints)

  store.getState().setPeriod('day')
  await store.getState().refreshChart('sh600000', 'day')
  expect(store.getState().points).toStrictEqual(historicalPoints)
})
