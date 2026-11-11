import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { fetchFiveDay, fetchHistorical, fetchIntraday, fetchQuoteNames, fetchQuotes } from '../src/api/index.ts'
import { setActiveLocale, t } from '../src/i18n/core.ts'
import { DEFAULT_LOCALE } from '../src/i18n/locale.ts'
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
  // 本文件断言中文错误文案, 固定语言避免跟随运行环境的系统语言
  setActiveLocale(DEFAULT_LOCALE)
})

afterEach(() => {
  vi.unstubAllGlobals()
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

  await expect(fetchQuotes(['sh600000'])).rejects.toThrow(t('api.error.quote', { status: 503 }))
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

test('fetchHistorical 对非年周期使用前复权与原始粒度并裁剪 barCount', async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      data: {
        sh600000: {
          qfqday: [
            ['2026-08-17', '10.00', '10.20', '10.30', '9.90', '100'],
            ['2026-08-18', '10.20', '10.40', '10.50', '10.10', '200'],
            ['2026-08-19', '10.40', '10.60', '10.70', '10.30', '300'],
          ],
        },
      },
    }),
  }))
  vi.stubGlobal('fetch', fetchMock)

  const points = await fetchHistorical('sh600000', { period: 'day', barCount: 2 })
  expect(points.map((point) => point.date)).toStrictEqual(['2026-08-18', '2026-08-19'])
  expect(fetchMock).toHaveBeenCalledWith(
    'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600000%2Cday%2C%2C%2C2%2Cqfq',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )

  await fetchHistorical('sh600000', { period: 'month', barCount: 60 })
  expect(fetchMock).toHaveBeenLastCalledWith(
    'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600000%2Cmonth%2C%2C%2C60%2Cqfq',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
})

test('fetchHistorical 对非 2xx 响应抛错', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 502 })),
  )

  await expect(fetchHistorical('sh600000', { period: 'week', barCount: 60 })).rejects.toThrow(
    t('api.error.historical', { status: 502 }),
  )
})

test('fetchQuoteNames 投影为代码与名称并复用 fetchQuotes 的空请求短路', async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode(quoteResponseText(['sh600000', 'sz000001'])),
  }))
  vi.stubGlobal('fetch', fetchMock)

  expect(await fetchQuoteNames([])).toStrictEqual([])
  expect(fetchMock).not.toHaveBeenCalled()

  expect(await fetchQuoteNames(['sh600000', 'sz000001'])).toStrictEqual([
    ['sh600000', 'SH600000'],
    ['sz000001', 'SZ000001'],
  ])
  // 名称投影只发一次行情请求, 不套第二层 timing wrapper
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('fetchIntraday 请求分时接口并解析数据点', async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      data: { sh600000: { data: { data: ['0930 10.00 100 1000', '0931 10.10 200 2000'] } } },
    }),
  }))
  vi.stubGlobal('fetch', fetchMock)

  expect(await fetchIntraday('sh600000')).toStrictEqual([
    { time: '0930', price: 10, volume: 100 },
    { time: '0931', price: 10.1, volume: 200 },
  ])
  expect(fetchMock).toHaveBeenCalledWith(
    'https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sh600000',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
})

test('fetchFiveDay 请求五日接口并解析会话数据', async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      data: { sh600000: { data: [{ date: '20260820', prec: '9.90', data: ['0930 10.00 100'] }] } },
    }),
  }))
  vi.stubGlobal('fetch', fetchMock)

  expect(await fetchFiveDay('sh600000')).toStrictEqual([
    { time: '0930', price: 10, volume: 100, sessionDate: '2026-08-20', prevClose: 9.9 },
  ])
  expect(fetchMock).toHaveBeenCalledWith(
    'https://web.ifzq.gtimg.cn/appstock/app/day/query?code=sh600000',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  )
})

test('分时与五日接口对非 2xx 响应给出各自的错误文案', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 500 })),
  )

  await expect(fetchIntraday('sh600000')).rejects.toThrow(t('api.error.intraday', { status: 500 }))
  await expect(fetchFiveDay('sh600000')).rejects.toThrow(t('api.error.fiveDay', { status: 500 }))
})

test('请求超时使用发起时读取的配置, 修改配置不影响已启动的请求', async () => {
  const fetchMock = vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  // 低于 SETTING_LIMITS 的取值也能生效: wrapper 只读当前状态, 超时由 AbortSignal.timeout 负责
  useSettingsStore.setState({ requestTimeoutMs: 20 })

  const pending = fetchQuotes(['sh600000'])
  useSettingsStore.setState({ requestTimeoutMs: 5000 })

  await expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
})
