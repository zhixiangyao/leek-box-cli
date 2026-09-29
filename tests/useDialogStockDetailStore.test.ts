import { expect, test } from 'vitest'

import type { IntradayPoint } from '../src/api/types.ts'
import { createDialogStockDetailStore } from '../src/stores/useDialogStockDetailStore.ts'

test('股票详情忽略先前打开代码已完成的请求', async () => {
  let resolveOld: (points: IntradayPoint[]) => void = () => undefined
  const oldRequest = new Promise<IntradayPoint[]>((resolve) => {
    resolveOld = resolve
  })
  const newPoints = [{ time: '0930', price: 12, volume: 10 }]
  const store = createDialogStockDetailStore({
    fetchIntraday: async (code) => (code === 'sh600000' ? oldRequest : newPoints),
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
