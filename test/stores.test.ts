import assert from 'node:assert/strict'
import test from 'node:test'

import type { IntradayPoint, Quote } from '../src/api/types.ts'
import type { WatchEntry } from '../src/lib/watchlist.ts'
import { createAddStockStore } from '../src/stores/useAddStockStore.ts'
import { createRemoveStockStore } from '../src/stores/useRemoveStockStore.ts'
import { createStockDetailStore } from '../src/stores/useStockDetailStore.ts'
import { createStockListStore } from '../src/stores/useStockListStore.ts'

const entry = (code: string, name = code): WatchEntry => ({
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

test('add stock store reports a duplicate found during the final locked write', async () => {
  const store = createAddStockStore({
    addStock: async () => ({ status: 'duplicate' }),
    fetchQuotes: async () => [quote('sh600000', '浦发银行')],
    loadWatchlist: async () => [],
    normalizeCode: () => 'sh600000',
    now: () => '2026-08-20T00:00:00.000Z',
  })

  await store.getState().handleCodeInput('600000')
  assert.equal(store.getState().step.type, 'confirm')
  await store.getState().handleConfirm('y')
  assert.deepEqual(store.getState().step, { type: 'already-exists', code: 'sh600000', name: '浦发银行' })
})

test('remove stock store reports an entry removed by another process', async () => {
  const target = entry('sz000001', '平安银行')
  const store = createRemoveStockStore({
    loadWatchlist: async () => [target],
    removeStock: async () => null,
  })

  await store.getState().loadEntries()
  store.getState().handleChoice('1')
  await store.getState().handleConfirm('y')
  assert.deepEqual(store.getState().step, {
    type: 'error',
    message: '平安银行 (sz000001) 已不在自选股中.',
  })
})

test('stock list preserves watchlist order, selected code, and unchanged quote references', async () => {
  const firstEntries = [entry('sh600000'), entry('sz000001'), entry('sz300001')]
  const secondEntries = [entry('sz300001'), entry('sz000001')]
  const thirdEntries = [entry('sz300001')]
  const entryRounds = [firstEntries, secondEntries, thirdEntries]
  let round = 0

  const store = createStockListStore({
    loadWatchlist: async () => entryRounds[round++]!,
    fetchQuotes: async (codes) => codes.map((code) => quote(code)),
  })

  await store.getState().refreshQuotes()
  store.getState().moveSelection(1, 1)
  const firstStep = store.getState().step
  assert.equal(firstStep.type, 'table')
  if (firstStep.type !== 'table') return
  const selectedQuote = firstStep.rows[1]!.kind === 'quote' ? firstStep.rows[1]!.quote : null

  await store.getState().refreshQuotes()
  const secondStep = store.getState().step
  assert.equal(secondStep.type, 'table')
  if (secondStep.type !== 'table') return
  assert.deepEqual(
    secondStep.rows.map((row) => row.code),
    ['sz300001', 'sz000001'],
  )
  assert.equal(store.getState().selectedCode, 'sz000001')
  assert.equal(secondStep.rows[1]!.kind === 'quote' ? secondStep.rows[1]!.quote : null, selectedQuote)

  await store.getState().refreshQuotes()
  assert.equal(store.getState().selectedCode, 'sz300001')
  assert.equal(store.getState().scrollOffset, 0)
})

test('stock detail ignores a completed request for a previously opened code', async () => {
  let resolveOld: (points: IntradayPoint[]) => void = () => undefined
  const oldRequest = new Promise<IntradayPoint[]>((resolve) => {
    resolveOld = resolve
  })
  const newPoints = [{ time: '0930', price: 12, volume: 10 }]
  const store = createStockDetailStore({
    fetchIntraday: async (code) => (code === 'sh600000' ? oldRequest : newPoints),
  })

  store.getState().open('sh600000', '浦发银行')
  const pendingOld = store.getState().refreshChart('sh600000', 'day')
  store.getState().open('sz000001', '平安银行')
  await store.getState().refreshChart('sz000001', 'day')
  resolveOld([{ time: '0930', price: 10, volume: 1 }])
  await pendingOld

  assert.deepEqual(store.getState().points, newPoints)
  assert.equal(store.getState().stock?.code, 'sz000001')
})
