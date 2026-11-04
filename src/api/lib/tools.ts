import { setTimeout } from 'node:timers/promises'

import { useSettingsStore } from '../../stores/useSettingsStore.ts'
import type { HistoricalPoint } from '../types.ts'

/** 把股票代码规范化为腾讯行情前缀格式 (如 "600000.SH" -> "sh600000"), 无法识别返回 undefined */
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

/** 包裹请求: 组合调用方取消信号与全局超时, 成功请求补足 minimumRequestDurationMs */
export const withRequestTiming = async <Result>(
  signal: AbortSignal | undefined,
  request: (signal: AbortSignal) => Promise<Result>,
): Promise<Result> => {
  const { requestTimeoutMs, minimumRequestDurationMs } = useSettingsStore.getState()
  const timeoutSignal = AbortSignal.timeout(requestTimeoutMs)
  const requestAbortSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
  const startedAt = Date.now()

  const result = await request(requestAbortSignal)
  const remainingDuration = minimumRequestDurationMs - (Date.now() - startedAt)
  if (remainingDuration > 0) {
    try {
      await setTimeout(remainingDuration, undefined, { signal })
    } catch (error) {
      // timers/promises 统一抛 AbortError, 这里还原调用方的 reason
      if (signal?.aborted) throw signal.reason
      throw error
    }
  }
  return result
}

/** 将月 K 聚合成年 K: 每年取年末收盘价、区间最高/最低与累计成交量 */
export const aggregateYearly = (monthly: HistoricalPoint[]): HistoricalPoint[] => {
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
