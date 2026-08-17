import { useCallback, useEffect, useRef, useState } from 'react'

import { errorMessage } from '../../lib/error.ts'
import { fetchQuotes, type Quote } from '../../lib/quote.ts'
import { loadWatchlist } from '../../lib/watchlist.ts'

/** 默认轮询间隔 5s; 可调范围 [1s, 60s], 步进 1s (看板 -/+ 键) */
export const DEFAULT_POLL_INTERVAL_MS = 5000
export const MIN_POLL_INTERVAL_MS = 1000
export const MAX_POLL_INTERVAL_MS = 60_000
export const POLL_INTERVAL_STEP_MS = 1000

export type Step =
  | { type: 'loading' }
  | { type: 'empty' } // 自选股为空
  | { type: 'error'; message: string } // 首次拉取失败 (无旧数据可展示)
  | {
      type: 'table'
      quotes: Quote[]
      missing: { code: string; name: string }[] // 请求了但接口没返回的股票
      updatedAt: string // 行情时间 HH:MM:SS (取各股最新)
      errorLine?: string // 轮询失败时保留旧表格并内联提示
    }

const formatClock = (timestamp: string) =>
  `${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}`

/** 股票涨跌看板: 轮询腾讯行情 (默认 5s, -/+ 可调), 自调度 setTimeout + in-flight 守卫避免重叠 */
export function useDashboard() {
  const [step, setStep] = useState<Step>({ type: 'loading' })
  const [pollIntervalMs, setPollIntervalMs] = useState(DEFAULT_POLL_INTERVAL_MS)
  const inFlightRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 间隔的唯一事实来源: 排程时读 ref, state 仅用于展示
  const pollIntervalRef = useRef(DEFAULT_POLL_INTERVAL_MS)
  const cancelledRef = useRef(false)
  const armNextRef = useRef<() => void>(() => {})

  const fetchOnce = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      const entries = await loadWatchlist()
      if (entries.length === 0) {
        setStep({ type: 'empty' })
        return
      }
      const quotes = await fetchQuotes(entries.map((entry) => entry.code))
      const quoteCodes = new Set(quotes.map((quote) => quote.code))
      const missing = entries
        .filter((entry) => !quoteCodes.has(entry.code))
        .map((entry) => ({ code: entry.code, name: entry.name }))
      const updatedAt = formatClock(quotes.reduce((max, quote) => (quote.timestamp > max ? quote.timestamp : max), ''))
      setStep({ type: 'table', quotes, missing, updatedAt })
    } catch (err) {
      const message = errorMessage(err)
      // 已有表格数据则保留旧数据 + 内联错误, 继续轮询自愈; 否则进 error 步
      setStep((prev) => (prev.type === 'table' ? { ...prev, errorLine: message } : { type: 'error', message }))
    } finally {
      inFlightRef.current = false
    }
  }, [])

  // 唯一排程点: 计时器触发 -> fetch -> 再排程; 已有计时器等待时不重复排, 天然单链不会重叠
  const armNext = useCallback(() => {
    if (cancelledRef.current || timerRef.current) return
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (cancelledRef.current) return
      void fetchOnce().finally(() => {
        if (cancelledRef.current) return
        armNextRef.current()
      })
    }, pollIntervalRef.current)
  }, [fetchOnce])

  useEffect(() => {
    armNextRef.current = armNext
  }, [armNext])

  useEffect(() => {
    cancelledRef.current = false
    void fetchOnce()
    armNextRef.current()
    return () => {
      cancelledRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [fetchOnce, armNext])

  /** 手动立即刷新 (有 in-flight 请求则忽略) */
  const handleRefreshNow = () => {
    void fetchOnce()
  }

  /** 调整轮询间隔 (1s 步进, 夹在 [1s, 60s]); 重置等待期让新间隔立即生效 */
  const handleAdjustInterval = (deltaMs: number) => {
    const next = Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, pollIntervalRef.current + deltaMs))
    if (next === pollIntervalRef.current) return
    pollIntervalRef.current = next
    setPollIntervalMs(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    armNextRef.current()
  }

  return { step, pollIntervalMs, handleRefreshNow, handleAdjustInterval }
}
