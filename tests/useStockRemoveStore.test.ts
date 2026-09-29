import { setTimeout as delay } from 'node:timers/promises'

import { expect, test } from 'vitest'

import type { QuoteName } from '../src/api/types.ts'
import type { StockEntry } from '../src/settings/schema.ts'
import { createStockRemoveStore, type StockRemoveDependencies } from '../src/stores/useStockRemoveStore.ts'
import { removeEntry, stockEntry } from './helpers/fixtures.ts'

/** StockRemove store 默认依赖: 自选股为空, 行情按代码给出固定名称 */
const removeStore = (overrides: Partial<StockRemoveDependencies> = {}) =>
  createStockRemoveStore({
    loadStocks: async () => [],
    fetchQuoteNames: async (codes) => codes.map<QuoteName>((code) => [code, `名称${code}`]),
    ...overrides,
  })

test('StockRemove store 按文件里的代码顺序加载网格, 名称取自实时行情', async () => {
  const store = removeStore({
    loadStocks: async () => [stockEntry('sz000001'), stockEntry('sh600000'), stockEntry('sz300001')],
    fetchQuoteNames: async (): Promise<QuoteName[]> => [
      ['sz000001', '平安银行'],
      ['sh600000', '浦发银行'],
    ],
  })

  await store.getState().loadEntries()
  // 行情只返回了两个代码的名称, sz300001 该条目只有代码
  expect(store.getState().entries).toStrictEqual([
    removeEntry('sz000001', '平安银行'),
    removeEntry('sh600000', '浦发银行'),
    removeEntry('sz300001'),
  ])
})

test('StockRemove store 按代码移除条目并递增 resetToken', async () => {
  const store = removeStore({
    loadStocks: async () => [stockEntry('sz000001'), stockEntry('sh600000'), stockEntry('sz300001')],
  })

  await store.getState().loadEntries()
  const token = store.getState().resetToken
  store.getState().removeByCodes(['sz000001', 'sz300001'])
  expect(store.getState().entries.map((entry) => entry.code)).toStrictEqual(['sh600000'])
  expect(store.getState().resetToken).toBe(token + 1)
})

test('StockRemove store 加载失败时记录错误信息, 重试成功后清空', async () => {
  let fails = true
  const store = removeStore({
    loadStocks: async () => {
      if (fails) throw new Error('配置文件损坏')
      return [stockEntry('sh600000')]
    },
    fetchQuoteNames: async (): Promise<QuoteName[]> => [['sh600000', '浦发银行']],
  })

  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([])
  expect(store.getState().errorMessage).toBe('配置文件损坏')

  fails = false
  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
  expect(store.getState().errorMessage).toBeUndefined()
})

test('StockRemove store 先铺出代码, 行情到达后再补上名称', async () => {
  let resolveNames!: (names: [string, string][]) => void
  const store = removeStore({
    loadStocks: async () => [stockEntry('sh600000')],
    fetchQuoteNames: () =>
      new Promise<[string, string][]>((resolve) => {
        resolveNames = resolve
      }),
  })

  const pending = store.getState().loadEntries()
  // 行情还没回来: 网格已经可以勾选, 只是单元格还没有名称
  await delay(0)
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000')])

  resolveNames([['sh600000', '浦发银行']])
  await pending
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
})

test('StockRemove store 名称在途中删掉的条目不会被名称覆盖回来', async () => {
  let resolveNames!: (names: [string, string][]) => void
  const store = removeStore({
    loadStocks: async () => [stockEntry('sz000001'), stockEntry('sh600000')],
    fetchQuoteNames: () =>
      new Promise<[string, string][]>((resolve) => {
        resolveNames = resolve
      }),
  })

  const pending = store.getState().loadEntries()
  // 网格已经铺出代码, 用户在等名称期间删掉一条
  await delay(0)
  store.getState().removeByCodes(['sz000001'])

  resolveNames([
    ['sz000001', '平安银行'],
    ['sh600000', '浦发银行'],
  ])
  await pending
  // 名称只补到还在网格里的条目上, 已删除的不会被整表覆盖回来
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
})

test('StockRemove store 陈旧的一轮失败不会清空新一轮加载的网格', async () => {
  let rejectFirst!: (error: Error) => void
  let calls = 0
  const store = removeStore({
    loadStocks: async () => [stockEntry('sh600000')],
    fetchQuoteNames: async (): Promise<QuoteName[]> => {
      calls += 1
      // 第一轮行情挂在超时边缘, 第二轮已经成功返回
      if (calls > 1) return [['sh600000', '浦发银行']] as [string, string][]
      return new Promise<[string, string][]>((_resolve, reject) => {
        rejectFirst = reject
      })
    },
  })

  const stale = store.getState().loadEntries()
  await delay(0)
  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])

  rejectFirst(new Error('网络错误'))
  await stale
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
  expect(store.getState().errorMessage).toBeUndefined()
})

test('StockRemove store 陈旧的一轮不会把网格退回只有代码的状态', async () => {
  let resolveFirstStocks!: (stocks: StockEntry[]) => void
  let calls = 0
  const store = removeStore({
    loadStocks: () => {
      calls += 1
      if (calls > 1) return Promise.resolve([stockEntry('sh600000')])
      // 第一轮读到的是更早的文件内容, 且此时才回来
      return new Promise<StockEntry[]>((resolve) => {
        resolveFirstStocks = resolve
      })
    },
    fetchQuoteNames: async (): Promise<QuoteName[]> => [['sh600000', '浦发银行']] as [string, string][],
  })

  const stale = store.getState().loadEntries()
  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])

  resolveFirstStocks([stockEntry('sz000001')])
  // 陈旧的一轮已经越过文件读取, 若它会落地, 网格这时就只剩代码 (而且是旧文件的代码)
  await delay(0)
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
  await stale
})

test('StockRemove store 行情失败时暴露错误并清空网格', async () => {
  let fails = true
  const store = removeStore({
    loadStocks: async () => [stockEntry('sh600000')],
    fetchQuoteNames: async (): Promise<QuoteName[]> => {
      if (fails) throw new Error('网络错误')
      return [['sh600000', '浦发银行']]
    },
  })

  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([])
  expect(store.getState().errorMessage).toBe('网络错误')

  fails = false
  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
  expect(store.getState().errorMessage).toBeUndefined()
})

test('StockRemove store 移除未命中的代码时列表不变但仍递增 resetToken', async () => {
  const store = removeStore({
    loadStocks: async () => [stockEntry('sz000001'), stockEntry('sh600000')],
    fetchQuoteNames: async (): Promise<QuoteName[]> => [
      ['sz000001', '平安银行'],
      ['sh600000', '浦发银行'],
    ],
  })
  await store.getState().loadEntries()
  const entries = store.getState().entries

  const token = store.getState().resetToken
  store.getState().removeByCodes(['sz300001'])
  expect(store.getState().entries).toStrictEqual(entries)
  expect(store.getState().resetToken).toBe(token + 1)

  store.getState().removeByCodes([])
  expect(store.getState().entries).toStrictEqual(entries)
  expect(store.getState().resetToken).toBe(token + 2)
})
