/**
 * 腾讯行情接口封装
 * - 实时行情: https://qt.gtimg.cn/q=... (GBK 文本, 免费无需鉴权)
 * - 分时图: https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=... (JSON)
 */

import { parseIntradayResponse, parseQuoteText } from './parsers.ts'
import type { IntradayPoint, Quote } from './types.ts'

export { parseIntradayResponse, parseQuoteText } from './parsers.ts'
export type { IntradayPoint, Quote } from './types.ts'

const FETCH_TIMEOUT_MS = 8000

const requestSignal = (signal?: AbortSignal) => {
  const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
}

/** 股票代码规范化: 支持 600000 / sh600000 / SH600000 / 600000.SH, 输出 'sh600000' 或 null. */
export function normalizeCode(input: string): string | null {
  let code = input.trim().toUpperCase()
  code = code.replace(/\.(SH|SZ|BJ)$/, '')
  code = code.replace(/^(SH|SZ|BJ)/, '')
  if (!/^\d{6}$/.test(code)) return null

  let prefix: string
  if (code.startsWith('6') || code.startsWith('5')) {
    prefix = 'sh'
  } else if (code.startsWith('0') || code.startsWith('1') || code.startsWith('3')) {
    prefix = 'sz'
  } else if (code.startsWith('4') || code.startsWith('8') || code.startsWith('92')) {
    prefix = 'bj'
  } else {
    return null
  }
  return `${prefix}${code}`
}

/** 拉取一批股票代码的实时行情; 无效代码被接口丢弃, 返回结果可能少于请求. */
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

/** 拉取单只股票今日分时; 非交易时段或无效代码返回空数组, 15:00 后补点会被裁剪. */
export async function fetchIntraday(code: string, signal?: AbortSignal): Promise<IntradayPoint[]> {
  const response = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${code}`, {
    signal: requestSignal(signal),
  })
  if (!response.ok) throw new Error(`分时接口请求失败: HTTP ${response.status}`)
  return parseIntradayResponse(await response.json(), code)
}
