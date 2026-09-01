import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { fetchHistorical, fetchQuotes, normalizeCode, parseIntradayResponse, parseQuoteText } from '../src/api/index.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'

/** 构造腾讯实时行情响应字段, 名称使用 ASCII 保证 GBK 编码与 UTF-8 一致 */
const quoteFields = (name: string): string[] => {
  const fields = Array<string>(50).fill('')
  fields[1] = name
  fields[3] = '10.25'
  fields[4] = '10.00'
  fields[5] = '10.10'
  fields[30] = '20260820150000'
  fields[31] = '0.25'
  fields[32] = '2.50'
  fields[33] = '10.30'
  fields[34] = '9.95'
  fields[36] = '12345'
  fields[37] = '6789'
  fields[38] = '1.20'
  fields[43] = '3.50'
  fields[45] = '2000'
  fields[49] = '1.10'
  return fields
}

const quoteResponseText = (codes: string[]) =>
  codes.map((code) => `v_${code}="${quoteFields(code.toUpperCase()).join('~')}";`).join('')

beforeEach(() => {
  useSettingsStore.getState().resetSettings()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('normalizeCode 支持常见的 A 股代码格式', () => {
  expect(normalizeCode('600000.SH')).toBe('sh600000')
  expect(normalizeCode('SZ000001')).toBe('sz000001')
  expect(normalizeCode('920001')).toBe('bj920001')
  expect(normalizeCode('invalid')).toBeUndefined()
})

test('parseQuoteText 映射腾讯字段并跳过格式错误的记录', () => {
  const fields = Array<string>(50).fill('')
  fields[1] = '浦发银行'
  fields[3] = '10.25'
  fields[4] = '10.00'
  fields[5] = '10.10'
  fields[30] = '20260820150000'
  fields[31] = '0.25'
  fields[32] = '2.50'
  fields[33] = '10.30'
  fields[34] = '9.95'
  fields[36] = '12345'
  fields[37] = '6789'
  fields[38] = '1.20'
  fields[43] = '3.50'
  fields[45] = '2000'
  fields[49] = '1.10'

  const [quote] = parseQuoteText(`garbage;v_sh600000="${fields.join('~')}";`)
  expect(quote).toStrictEqual({
    code: 'sh600000',
    name: '浦发银行',
    current: 10.25,
    prevClose: 10,
    open: 10.1,
    high: 10.3,
    low: 9.95,
    change: 0.25,
    changePercent: 2.5,
    timestamp: '20260820150000',
    volume: 12345,
    turnover: 6789,
    turnoverRate: 1.2,
    amplitude: 3.5,
    marketCap: 2000,
    volumeRatio: 1.1,
  })
})

test('parseIntradayResponse 过滤格式错误和收盘后的数据点', () => {
  const points = parseIntradayResponse(
    {
      data: {
        sh600000: {
          data: {
            data: [
              '0930 10.00 100 1000',
              '1260 10.10 200 2000',
              '1500 10.20 300 3000',
              '1501 10.30 400 4000',
              'bad',
              42,
            ],
          },
        },
      },
    },
    'sh600000',
  )

  expect(points).toStrictEqual([
    { time: '0930', price: 10, volume: 100 },
    { time: '1500', price: 10.2, volume: 300 },
  ])
  expect(parseIntradayResponse({}, 'sh600000')).toStrictEqual([])
})

test('fetchQuotes 空请求直接返回空数组且不发起请求', async () => {
  const fetchMock = vi.fn(async () => ({ ok: true }))
  vi.stubGlobal('fetch', fetchMock)

  expect(await fetchQuotes([])).toStrictEqual([])
  expect(fetchMock).not.toHaveBeenCalled()
})

test('fetchQuotes 请求实时行情接口并用 GBK 解码响应', async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode(quoteResponseText(['sh600000', 'sz000001'])),
  }))
  vi.stubGlobal('fetch', fetchMock)

  const quotes = await fetchQuotes(['sh600000', 'sz000001'])
  expect(fetchMock).toHaveBeenCalledWith(
    'https://qt.gtimg.cn/q=sh600000,sz000001',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
  expect(quotes.map((quote) => quote.code)).toStrictEqual(['sh600000', 'sz000001'])
  expect(quotes[0]).toMatchObject({ current: 10.25, changePercent: 2.5 })
})

test('fetchQuotes 对非 2xx 响应抛错', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 503 })),
  )

  await expect(fetchQuotes(['sh600000'])).rejects.toThrow('行情接口请求失败: HTTP 503')
})

test('minimum duration 补足成功请求的耗时', async () => {
  useSettingsStore.getState().updateSettings({ minimumRequestDurationMs: 100 })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(quoteResponseText(['sh600000'])),
    })),
  )

  const startedAt = performance.now()
  await fetchQuotes(['sh600000'])
  expect(performance.now() - startedAt).toBeGreaterThanOrEqual(90)
})

test('minimum duration 不延迟失败的请求', async () => {
  useSettingsStore.getState().updateSettings({ minimumRequestDurationMs: 150 })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('网络错误')
    }),
  )

  const startedAt = performance.now()
  await expect(fetchQuotes(['sh600000'])).rejects.toThrow('网络错误')
  expect(performance.now() - startedAt).toBeLessThan(100)
})

test('调用方 signal 中止时取消底层请求', async () => {
  const controller = new AbortController()
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    ),
  )

  const promise = fetchQuotes(['sh600000'], controller.signal)
  controller.abort()
  await expect(promise).rejects.toThrow()
})

test('fetchHistorical 按年请求月 K 聚合到年份并裁剪最后 barCount', async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      data: {
        sh600000: {
          hfqmonth: [
            ['2026-01-15', '10.00', '10.50', '11.00', '9.00', '1000'],
            ['2026-02-13', '10.40', '9.80', '10.60', '9.60', '2000'],
            ['2025-12-18', '9.50', '9.90', '10.00', '9.40', '3000'],
          ],
        },
      },
    }),
  }))
  vi.stubGlobal('fetch', fetchMock)

  const points = await fetchHistorical('sh600000', { period: 'year', barCount: 2 })
  expect(points).toStrictEqual([
    { date: '2025-12-18', open: 9.5, close: 9.9, high: 10, low: 9.4, volume: 3000 },
    // 年度聚合: 低点为半年最低 9.00, 高点为半年最高 11.00, 成交量相加
    { date: '2026-02-13', open: 10, close: 9.8, high: 11, low: 9, volume: 3000 },
  ])
  // 年 K 请求 12 倍月 K 并指定后复权
  expect(fetchMock).toHaveBeenCalledWith(
    'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600000%2Cmonth%2C%2C%2C24%2Chfq',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
})
