import { parseFiveDayResponse, parseHistoricalResponse, parseIntradayResponse, parseQuoteText } from './lib/parsers.ts'
import { aggregateYearly, withRequestTiming } from './lib/tools.ts'
import type {
  FiveDayPoint,
  HistoricalPoint,
  HistoricalRequest,
  IntradayPoint,
  KlineAdjustment,
  KlineGranularity,
  Quote,
} from './types.ts'

/** 腾讯行情接口封装: 股票列表 */
export async function fetchQuotes(codes: string[], signal?: AbortSignal): Promise<Quote[]> {
  if (codes.length === 0) return []

  return withRequestTiming(signal, async (requestSignal) => {
    const response = await fetch(`https://qt.gtimg.cn/q=${codes.join(',')}`, {
      signal: requestSignal,
    })
    if (!response.ok) throw new Error(`行情接口请求失败: HTTP ${response.status}`)

    const buffer = await response.arrayBuffer()
    const text = new TextDecoder('gbk').decode(buffer)
    return parseQuoteText(text)
  })
}

/** 腾讯行情接口封装: 分时图 */
export async function fetchIntraday(code: string, signal?: AbortSignal): Promise<IntradayPoint[]> {
  return withRequestTiming(signal, async (requestSignal) => {
    const response = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${code}`, {
      signal: requestSignal,
    })
    if (!response.ok) throw new Error(`分时接口请求失败: HTTP ${response.status}`)
    return parseIntradayResponse(await response.json(), code)
  })
}

/** 腾讯行情接口封装: 五日图 */
export async function fetchFiveDay(code: string, signal?: AbortSignal): Promise<FiveDayPoint[]> {
  return withRequestTiming(signal, async (requestSignal) => {
    const response = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/day/query?code=${code}`, {
      signal: requestSignal,
    })
    if (!response.ok) throw new Error(`五日行情接口请求失败: HTTP ${response.status}`)
    return parseFiveDayResponse(await response.json(), code)
  })
}

/** 腾讯行情接口封装: 复权 K 线图 */
export async function fetchHistorical(code: string, request: HistoricalRequest): Promise<HistoricalPoint[]> {
  return withRequestTiming(request.signal, async (requestSignal) => {
    const granularity: KlineGranularity = request.period === 'year' ? 'month' : request.period
    const adjustment: KlineAdjustment = request.period === 'year' ? 'hfq' : 'qfq'
    const requestedBars = request.period === 'year' ? request.barCount * 12 : request.barCount
    const param = encodeURIComponent(`${code},${granularity},,,${requestedBars},${adjustment}`)
    const response = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${param}`, {
      signal: requestSignal,
    })
    if (!response.ok) throw new Error(`K 线行情接口请求失败: HTTP ${response.status}`)

    const points = parseHistoricalResponse(await response.json(), code, granularity, adjustment)
    return (request.period === 'year' ? aggregateYearly(points) : points).slice(-request.barCount)
  })
}
