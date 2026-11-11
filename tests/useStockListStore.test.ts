import { expect, test } from 'vitest'

import type { Quote } from '../src/api/types.ts'
import { createStockListStore } from '../src/stores/useStockListStore.ts'
import { quote, stockEntry } from './helpers/fixtures.ts'

type StockListStore = ReturnType<typeof createStockListStore>

const QUOTE_KEYS = Object.keys(quote()) as (keyof Quote)[]

const quoteOf = (store: StockListStore): Quote => {
  const step = store.getState().step
  if (step.type !== 'table') throw new Error('expected table step')
  const row = step.rows[0]
  if (row?.kind !== 'quote') throw new Error('expected quote row')
  return row.quote
}

/** 只改一个字段: 数值 +1, 其余追加后缀. code 由行情 map 的键决定, 不做逐字段比较 */
const changedQuote = (key: keyof Quote, base: Quote): Quote => {
  const value = base[key]
  return { ...base, [key]: typeof value === 'number' ? value + 1 : `${value}changed` } as Quote
}

test('quotesEqual 覆盖 Quote 的全部可观察字段', async () => {
  for (const key of QUOTE_KEYS.filter((candidate) => candidate !== 'code')) {
    const base = quote()
    let round = 0
    const store = createStockListStore({
      loadStocks: async () => [stockEntry('sh600000')],
      fetchQuotes: async () => [round++ === 0 ? base : changedQuote(key, base)],
    })

    await store.getState().refreshQuotes()
    const first = quoteOf(store)
    await store.getState().refreshQuotes()
    const second = quoteOf(store)

    expect(second, key).not.toBe(first)
  }
})

test('自选股为空时进入 empty, 不发行情请求', async () => {
  let fetchCalls = 0
  const store = createStockListStore({
    loadStocks: async () => [],
    fetchQuotes: async () => {
      fetchCalls += 1
      return []
    },
  })

  await store.getState().refreshQuotes()

  expect(store.getState().step).toStrictEqual({ type: 'empty' })
  expect(fetchCalls).toBe(0)
})

test('读取自选股失败时进入 error', async () => {
  const store = createStockListStore({
    loadStocks: async () => {
      throw new Error('配置文件损坏')
    },
    fetchQuotes: async () => [],
  })

  await store.getState().refreshQuotes()

  expect(store.getState().step).toStrictEqual({ type: 'error', message: '配置文件损坏' })
})

test('已有表格时刷新失败保留旧行并附带 errorLine, 下次成功清除', async () => {
  let fails = false
  const rows = [{ kind: 'missing' as const, code: 'sh600000' }]
  const store = createStockListStore({
    loadStocks: async () => [stockEntry('sh600000')],
    fetchQuotes: async () => {
      if (fails) throw new Error('接口超时')
      return []
    },
  })

  await store.getState().refreshQuotes()
  expect(store.getState().step).toStrictEqual({ type: 'table', rows })

  fails = true
  await store.getState().refreshQuotes()
  expect(store.getState().step).toStrictEqual({ type: 'table', rows, errorLine: '接口超时' })

  fails = false
  await store.getState().refreshQuotes()
  expect(store.getState().step).toStrictEqual({ type: 'table', rows })
})

test('已取消的信号不落地读取或行情结果', async () => {
  const beforeFetch = new AbortController()
  beforeFetch.abort()
  const loadStore = createStockListStore({
    loadStocks: async () => [stockEntry('sh600000')],
    fetchQuotes: async () => [],
  })
  await loadStore.getState().refreshQuotes(beforeFetch.signal)
  expect(loadStore.getState().step).toStrictEqual({ type: 'loading' })

  const afterFetch = new AbortController()
  const fetchStore = createStockListStore({
    loadStocks: async () => {
      afterFetch.abort()
      return [stockEntry('sh600000')]
    },
    fetchQuotes: async () => [],
  })
  await fetchStore.getState().refreshQuotes(afterFetch.signal)
  expect(fetchStore.getState().step).toStrictEqual({ type: 'loading' })
})

test('取消后行情抛错不进 error', async () => {
  const controller = new AbortController()
  const store = createStockListStore({
    loadStocks: async () => [stockEntry('sh600000')],
    fetchQuotes: async () => {
      controller.abort()
      throw new Error('aborted')
    },
  })

  await store.getState().refreshQuotes(controller.signal)

  expect(store.getState().step).toStrictEqual({ type: 'loading' })
})

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
