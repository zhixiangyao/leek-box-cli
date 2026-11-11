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

test('先前代码的请求失败不会把新股票置为 error', async () => {
  let rejectOld: (error: Error) => void = () => undefined
  const store = createDialogStockDetailStore({
    fetchIntraday: (code) =>
      code === 'sh600000'
        ? new Promise<IntradayPoint[]>((_resolve, reject) => {
            rejectOld = reject
          })
        : Promise.resolve(pointsOf(12)),
    fetchFiveDay: async () => [],
    fetchHistorical: async () => [],
  })

  store.getState().open('sh600000')
  const pendingOld = store.getState().refreshChart('sh600000', 'intraday')
  store.getState().open('sz000001')
  await store.getState().refreshChart('sz000001', 'intraday')

  rejectOld(new Error('接口超时'))
  await pendingOld

  expect(store.getState().status).toBe('ready')
  expect(store.getState().errorMessage).toBeUndefined()
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

const pointsOf = (price: number): IntradayPoint[] => [{ time: '0930', price, volume: 10 }]

const createStore = () =>
  createDialogStockDetailStore({
    fetchIntraday: async () => pointsOf(12),
    fetchFiveDay: async () => [],
    fetchHistorical: async () => [],
  })

test('open 重置周期, 状态与图表数据', async () => {
  const store = createStore()
  store.getState().open('sh600000')
  store.getState().setPeriod('day')
  await store.getState().refreshChart('sh600000', 'day')

  store.getState().open('sz000001')
  expect(store.getState().code).toBe('sz000001')
  expect(store.getState().period).toBe('intraday')
  expect(store.getState().status).toBe('loading')
  expect(store.getState().points).toStrictEqual([])
  expect(store.getState().errorMessage).toBeUndefined()
})

test('setPeriod 同周期早返回, 切周期清空数据并回到 loading', async () => {
  const store = createStore()
  store.getState().open('sh600000')
  await store.getState().refreshChart('sh600000', 'intraday')
  expect(store.getState().status).toBe('ready')

  const points = store.getState().points
  store.getState().setPeriod('intraday')
  expect(store.getState().status).toBe('ready')
  expect(store.getState().points).toBe(points)

  store.getState().setPeriod('week')
  expect(store.getState().period).toBe('week')
  expect(store.getState().status).toBe('loading')
  expect(store.getState().points).toStrictEqual([])
})

test('请求失败进入 error, 下一次成功清空错误信息', async () => {
  let fail = true
  const store = createDialogStockDetailStore({
    fetchIntraday: async () => {
      if (fail) throw new Error('接口超时')
      return pointsOf(12)
    },
    fetchFiveDay: async () => [],
    fetchHistorical: async () => [],
  })

  store.getState().open('sh600000')
  await store.getState().refreshChart('sh600000', 'intraday')
  expect(store.getState().status).toBe('error')
  expect(store.getState().errorMessage).toBe('接口超时')

  fail = false
  await store.getState().refreshChart('sh600000', 'intraday')
  expect(store.getState().status).toBe('ready')
  expect(store.getState().errorMessage).toBeUndefined()
})

test('已取消的信号不落地结果', async () => {
  const store = createStore()
  store.getState().open('sh600000')
  const controller = new AbortController()
  controller.abort()

  await store.getState().refreshChart('sh600000', 'intraday', controller.signal)
  expect(store.getState().status).toBe('loading')
  expect(store.getState().points).toStrictEqual([])
})

test('关闭弹窗清空代码, 后续结果不落地', async () => {
  let resolvePoints: (points: IntradayPoint[]) => void = () => undefined
  const store = createDialogStockDetailStore({
    fetchIntraday: () =>
      new Promise<IntradayPoint[]>((resolve) => {
        resolvePoints = resolve
      }),
    fetchFiveDay: async () => [],
    fetchHistorical: async () => [],
  })

  store.getState().open('sh600000')
  const pending = store.getState().refreshChart('sh600000', 'intraday')
  store.getState().close()
  resolvePoints(pointsOf(10))
  await pending

  expect(store.getState().code).toBeUndefined()
  expect(store.getState().points).toStrictEqual([])
})
