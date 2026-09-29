import { expect, test } from 'vitest'

import { createStockListStore } from '../src/stores/useStockListStore.ts'
import { quote, stockEntry } from './helpers/fixtures.ts'

test('股票列表保留自选股顺序并复用未变化的行情引用', async () => {
  const firstEntries = [stockEntry('sh600000'), stockEntry('sz000001'), stockEntry('sz300001')]
  const secondEntries = [stockEntry('sz300001'), stockEntry('sz000001')]
  const entryRounds = [firstEntries, secondEntries]
  let round = 0

  const store = createStockListStore({
    loadStocks: async () => entryRounds[round++]!,
    fetchQuotes: async (codes) => codes.map((code) => quote({ code, name: code })),
  })

  await store.getState().refreshQuotes()
  const firstStep = store.getState().step
  expect(firstStep.type).toBe('table')
  if (firstStep.type !== 'table') return
  expect(firstStep.rows.map((row) => row.code)).toStrictEqual(['sh600000', 'sz000001', 'sz300001'])
  const keptQuote = firstStep.rows[1]!.kind === 'quote' ? firstStep.rows[1]!.quote : undefined

  await store.getState().refreshQuotes()
  const secondStep = store.getState().step
  expect(secondStep.type).toBe('table')
  if (secondStep.type !== 'table') return
  // 顺序跟着自选股文件走, 行情没变化的行复用旧 Quote 引用
  expect(secondStep.rows.map((row) => row.code)).toStrictEqual(['sz300001', 'sz000001'])
  expect(secondStep.rows[1]!.kind === 'quote' ? secondStep.rows[1]!.quote : undefined).toBe(keptQuote)
})
