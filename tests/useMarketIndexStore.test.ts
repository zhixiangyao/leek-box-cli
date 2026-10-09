import { expect, test } from 'vitest'

import { createMarketIndexStore, MARKET_INDEX_CODES } from '../src/stores/useMarketIndexStore.ts'
import { quote } from './helpers/fixtures.ts'

test('指数行情按代码顺序落地, 与自选股无关', async () => {
  const requested: string[][] = []
  const store = createMarketIndexStore({
    fetchQuotes: async (codes) => {
      requested.push([...codes])
      return codes.map((code) => quote({ code, name: code }))
    },
  })

  await store.getState().refreshIndices()

  expect(requested).toStrictEqual([[...MARKET_INDEX_CODES]])
  expect(store.getState().indices.map((entry) => entry.code)).toStrictEqual([...MARKET_INDEX_CODES])
})

test('行情没返回的指数不占位', async () => {
  const store = createMarketIndexStore({
    fetchQuotes: async () => [quote({ code: 'sh000001', name: '上证指数' })],
  })

  await store.getState().refreshIndices()

  // 深证成指这一轮没返回: 直接少一条, 不留占位 (轮播按当前条数取模)
  expect(store.getState().indices.map((entry) => entry.code)).toStrictEqual(['sh000001'])
})

test('拉取失败时保留上一次的行情', async () => {
  let failing = false
  const store = createMarketIndexStore({
    fetchQuotes: async () => {
      if (failing) throw new Error('boom')
      return MARKET_INDEX_CODES.map((code) => quote({ code, name: code }))
    },
  })

  await store.getState().refreshIndices()
  const kept = store.getState().indices

  failing = true
  await expect(store.getState().refreshIndices()).rejects.toThrow('boom')
  expect(store.getState().indices).toBe(kept)
})
