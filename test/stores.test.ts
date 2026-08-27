import { expect, test } from 'vitest'

import type { IntradayPoint, Quote } from '../src/api/types.ts'
import type { StockEntry } from '../src/lib/settings.ts'
import { createStockAddStore } from '../src/stores/useStockAddStore.ts'
import { createStockDetailStore } from '../src/stores/useStockDetailStore.ts'
import { createStockListStore } from '../src/stores/useStockListStore.ts'
import { createStockRemoveStore } from '../src/stores/useStockRemoveStore.ts'

const entry = (code: string, name = code): StockEntry => ({
  code,
  name,
  addedAt: '2026-08-20T00:00:00.000Z',
})

const quote = (code: string, name = code): Quote => ({
  code,
  name,
  current: 10,
  prevClose: 9,
  open: 9.5,
  high: 10.5,
  low: 9.4,
  change: 1,
  changePercent: 11.11,
  timestamp: '20260820150000',
  volume: 100,
  turnover: 200,
  turnoverRate: 1,
  amplitude: 2,
  marketCap: 300,
  volumeRatio: 1.2,
})

test('添加股票时报告最终加锁写入发现的重复项', async () => {
  const store = createStockAddStore({
    stockAdd: async () => ({ status: 'duplicate' }),
    fetchQuotes: async () => [quote('sh600000', '浦发银行')],
    loadStocks: async () => [],
    normalizeCode: () => 'sh600000',
    now: () => '2026-08-20T00:00:00.000Z',
  })

  await store.getState().handleCodeInput('600000')
  expect(store.getState().step.type).toBe('confirm')
  await store.getState().handleConfirm('y')
  expect(store.getState().step).toStrictEqual({ type: 'already-exists', code: 'sh600000', name: '浦发银行' })
})

test('删除股票时报告已被其他进程删除的条目', async () => {
  const target = entry('sz000001', '平安银行')
  const store = createStockRemoveStore({
    loadStocks: async () => [target],
    stockRemove: async () => undefined,
  })

  await store.getState().loadEntries()
  store.getState().handleChoice('1')
  await store.getState().handleConfirm('y')
  expect(store.getState().step).toStrictEqual({
    type: 'error',
    message: '平安银行 (sz000001) 已不在自选股中.',
  })
})

test('股票列表保留自选股顺序, 选中代码和未变化的行情引用', async () => {
  const firstEntries = [entry('sh600000'), entry('sz000001'), entry('sz300001')]
  const secondEntries = [entry('sz300001'), entry('sz000001')]
  const thirdEntries = [entry('sz300001')]
  const entryRounds = [firstEntries, secondEntries, thirdEntries]
  let round = 0

  const store = createStockListStore({
    loadStocks: async () => entryRounds[round++]!,
    fetchQuotes: async (codes) => codes.map((code) => quote(code)),
  })

  await store.getState().refreshQuotes()
  store.getState().moveSelection(1, 1)
  const firstStep = store.getState().step
  expect(firstStep.type).toBe('table')
  if (firstStep.type !== 'table') return
  const selectedQuote = firstStep.rows[1]!.kind === 'quote' ? firstStep.rows[1]!.quote : undefined

  await store.getState().refreshQuotes()
  const secondStep = store.getState().step
  expect(secondStep.type).toBe('table')
  if (secondStep.type !== 'table') return
  expect(secondStep.rows.map((row) => row.code)).toStrictEqual(['sz300001', 'sz000001'])
  expect(store.getState().selectedCode).toBe('sz000001')
  expect(secondStep.rows[1]!.kind === 'quote' ? secondStep.rows[1]!.quote : undefined).toBe(selectedQuote)

  await store.getState().refreshQuotes()
  expect(store.getState().selectedCode).toBe('sz300001')
  expect(store.getState().scrollOffset).toBe(0)
})

test('股票详情忽略先前打开代码已完成的请求', async () => {
  let resolveOld: (points: IntradayPoint[]) => void = () => undefined
  const oldRequest = new Promise<IntradayPoint[]>((resolve) => {
    resolveOld = resolve
  })
  const newPoints = [{ time: '0930', price: 12, volume: 10 }]
  const store = createStockDetailStore({
    fetchIntraday: async (code) => (code === 'sh600000' ? oldRequest : newPoints),
  })

  store.getState().open('sh600000', '浦发银行')
  const pendingOld = store.getState().refreshChart('sh600000', 'intraday')
  store.getState().open('sz000001', '平安银行')
  await store.getState().refreshChart('sz000001', 'intraday')
  resolveOld([{ time: '0930', price: 10, volume: 1 }])
  await pendingOld

  expect(store.getState().points).toStrictEqual(newPoints)
  expect(store.getState().stock?.code).toBe('sz000001')
})
