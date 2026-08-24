/**
 * 腾讯行情接口封装
 * - 实时行情: https://qt.gtimg.cn/q=... (GBK 文本, 免费无需鉴权)
 * - 分时图: https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=... (JSON)
 * - 五日图: https://web.ifzq.gtimg.cn/appstock/app/day/query?code=... (JSON)
 * - 复权 K 线: https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=... (JSON)
 */

import { parseFiveDayResponse, parseHistoricalResponse, parseIntradayResponse, parseQuoteText } from './parsers.ts'
import type {
  FiveDayPoint,
  HistoricalPoint,
  IntradayPoint,
  KlineAdjustment,
  KlineGranularity,
  KlinePeriod,
  Quote,
} from './types.ts'

export { parseFiveDayResponse, parseHistoricalResponse, parseIntradayResponse, parseQuoteText } from './parsers.ts'
export type {
  ChartPeriod,
  ChartPoint,
  FiveDayPoint,
  HistoricalPoint,
  IntradayPoint,
  KlineAdjustment,
  KlineGranularity,
  KlinePeriod,
  Quote,
} from './types.ts'

export type HistoricalRequest = {
  period: KlinePeriod
  barCount: number
  signal?: AbortSignal
}

const FETCH_TIMEOUT_MS = 8000

const requestSignal = (signal?: AbortSignal) => {
  const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
}

/** 股票代码规范化 */
export function normalizeCode(input: string): string | undefined {
  let code = input.trim().toUpperCase()
  code = code.replace(/\.(SH|SZ|BJ)$/, '')
  code = code.replace(/^(SH|SZ|BJ)/, '')
  if (!/^\d{6}$/.test(code)) return undefined

  let prefix: string
  if (code.startsWith('6') || code.startsWith('5')) {
    prefix = 'sh'
  } else if (code.startsWith('0') || code.startsWith('1') || code.startsWith('3')) {
    prefix = 'sz'
  } else if (code.startsWith('4') || code.startsWith('8') || code.startsWith('92')) {
    prefix = 'bj'
  } else {
    return undefined
  }
  return `${prefix}${code}`
}

/** 拉取一批股票代码的实时行情; 无效代码被接口丢弃, 返回结果可能少于请求 */
export async function fetchQuotes(codes: string[], signal?: AbortSignal): Promise<Quote[]> {
  if (codes.length === 0) return []

  const response = await fetch(`https://qt.gtimg.cn/q=${codes.join(',')}`, {
    signal: requestSignal(signal),
  })
  if (!response.ok) throw new Error(`行情接口请求失败: HTTP ${response.status}`)

  const buffer = await response.arrayBuffer()
  const text = new TextDecoder('gbk').decode(buffer)
  return parseQuoteText(text)
}

/** 拉取单只股票今日分时; 非交易时段或无效代码返回空数组, 15:00 后补点会被裁剪 */
export async function fetchIntraday(code: string, signal?: AbortSignal): Promise<IntradayPoint[]> {
  const response = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${code}`, {
    signal: requestSignal(signal),
  })
  if (!response.ok) throw new Error(`分时接口请求失败: HTTP ${response.status}`)
  return parseIntradayResponse(await response.json(), code)
}

/** 拉取最近五个交易日的分钟走势 */
export async function fetchFiveDay(code: string, signal?: AbortSignal): Promise<FiveDayPoint[]> {
  const response = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/day/query?code=${code}`, {
    signal: requestSignal(signal),
  })
  if (!response.ok) throw new Error(`五日行情接口请求失败: HTTP ${response.status}`)
  return parseFiveDayResponse(await response.json(), code)
}

const aggregateYearly = (monthly: HistoricalPoint[]): HistoricalPoint[] => {
  const yearly = new Map<string, HistoricalPoint>()
  for (const point of [...monthly].sort((left, right) => left.date.localeCompare(right.date))) {
    const year = point.date.slice(0, 4)
    const current = yearly.get(year)
    if (!current) {
      yearly.set(year, { ...point })
      continue
    }
    current.date = point.date
    current.close = point.close
    current.high = Math.max(current.high, point.high)
    current.low = Math.min(current.low, point.low)
    current.volume += point.volume
  }
  return [...yearly.values()]
}

/** 拉取指定粒度的复权 K 线; 年 K 使用后复权月 K 在本地聚合, 避免高分红股票早期前复权价为负 */
export async function fetchHistorical(code: string, request: HistoricalRequest): Promise<HistoricalPoint[]> {
  const granularity: KlineGranularity = request.period === 'year' ? 'month' : request.period
  const adjustment: KlineAdjustment = request.period === 'year' ? 'hfq' : 'qfq'
  const requestedBars = request.period === 'year' ? request.barCount * 12 : request.barCount
  const param = encodeURIComponent(`${code},${granularity},,,${requestedBars},${adjustment}`)
  const response = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${param}`, {
    signal: requestSignal(request.signal),
  })
  if (!response.ok) throw new Error(`K 线行情接口请求失败: HTTP ${response.status}`)

  const points = parseHistoricalResponse(await response.json(), code, granularity, adjustment)
  return (request.period === 'year' ? aggregateYearly(points) : points).slice(-request.barCount)
}
