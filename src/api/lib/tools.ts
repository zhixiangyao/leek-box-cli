import { useSettingsStore } from '../../stores/useSettingsStore.ts'
import { HistoricalPoint } from '../types.ts'

/** 规范化股票代码为腾讯行情前缀格式 (如 "600000"/"600000.SH" → "sh600000"); 无法识别返回 undefined */
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

const abortableDelay = (milliseconds: number, signal?: AbortSignal) => {
  if (milliseconds <= 0) return Promise.resolve()
  if (signal?.aborted) return Promise.reject(signal.reason)

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, milliseconds)
    const handleAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

/** 包裹请求: 组合调用方取消信号与全局超时, 并让成功请求至少持续 minimumRequestDurationMs 以避免 UI 闪烁 */
export const withRequestTiming = async <Result>(
  signal: AbortSignal | undefined,
  request: (signal: AbortSignal) => Promise<Result>,
): Promise<Result> => {
  const { requestTimeoutMs, minimumRequestDurationMs } = useSettingsStore.getState()
  const timeoutSignal = AbortSignal.timeout(requestTimeoutMs)
  const requestAbortSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
  const startedAt = Date.now()

  const result = await request(requestAbortSignal)
  await abortableDelay(minimumRequestDurationMs - (Date.now() - startedAt), signal)
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
