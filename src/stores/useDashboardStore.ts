import { create } from 'zustand'

import { fetchQuotes, type Quote } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'
import { loadWatchlist } from '../lib/watchlist.ts'

/** 默认轮询间隔 5s; 可调范围 [1s, 60s], 步进 1s (看板 -/+ 键) */
export const DEFAULT_POLL_INTERVAL_MS = 5000
export const MIN_POLL_INTERVAL_MS = 1000
export const MAX_POLL_INTERVAL_MS = 60_000
export const POLL_INTERVAL_STEP_MS = 1000

export type DashboardStep =
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

type DashboardState = {
  step: DashboardStep
  pollIntervalMs: number
  /** 进入看板页时启动轮询: 重置 step + 立即拉取 + 排下一次 */
  start: () => void
  /** 离开看板页时停止轮询并丢弃进行中的结果 */
  stop: () => void
  /** 手动立即刷新 (有 in-flight 请求则忽略) */
  refreshNow: () => void
  /** 调整轮询间隔 (1s 步进, 夹在 [1s, 60s]); 重置等待期让新间隔立即生效 */
  adjustInterval: (deltaMs: number) => void
}

// 轮询循环的非响应式状态: 排程/守卫用模块级变量, store 只承载展示数据
let inFlight = false
let timer: ReturnType<typeof setTimeout> | null = null
let pollInterval = DEFAULT_POLL_INTERVAL_MS
let cancelled = false

const formatClock = (timestamp: string) =>
  `${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}`

/** 股票涨跌看板 store: 轮询腾讯行情 (默认 5s, -/+ 可调), 自调度 setTimeout + in-flight 守卫避免重叠 */
export const useDashboardStore = create<DashboardState>()((set) => {
  const fetchOnce = async () => {
    if (inFlight) return
    inFlight = true
    try {
      const entries = await loadWatchlist()
      if (cancelled) return // 已离开看板, 丢弃结果
      if (entries.length === 0) {
        set({ step: { type: 'empty' } })
        return
      }
      const quotes = await fetchQuotes(entries.map((entry) => entry.code))
      if (cancelled) return
      const quoteCodes = new Set(quotes.map((quote) => quote.code))
      const missing = entries
        .filter((entry) => !quoteCodes.has(entry.code))
        .map((entry) => ({ code: entry.code, name: entry.name }))
      const updatedAt = formatClock(quotes.reduce((max, quote) => (quote.timestamp > max ? quote.timestamp : max), ''))
      set({ step: { type: 'table', quotes, missing, updatedAt } })
    } catch (err) {
      if (cancelled) return
      const message = errorMessage(err)
      // 已有表格数据则保留旧数据 + 内联错误, 继续轮询自愈; 否则进 error 步
      set((state) =>
        state.step.type === 'table'
          ? { step: { ...state.step, errorLine: message } }
          : { step: { type: 'error', message } },
      )
    } finally {
      inFlight = false
    }
  }

  // 唯一排程点: 计时器触发 -> fetch -> 再排程; 已有计时器等待时不重复排, 天然单链不会重叠
  const armNext = () => {
    if (cancelled || timer) return
    timer = setTimeout(() => {
      timer = null
      if (cancelled) return
      void fetchOnce().finally(() => {
        if (cancelled) return
        armNext()
      })
    }, pollInterval)
  }

  return {
    step: { type: 'loading' },
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    start: () => {
      cancelled = false
      set({ step: { type: 'loading' } })
      void fetchOnce()
      armNext()
    },
    stop: () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      timer = null
    },
    refreshNow: () => {
      void fetchOnce()
    },
    adjustInterval: (deltaMs: number) => {
      const next = Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, pollInterval + deltaMs))
      if (next === pollInterval) return
      pollInterval = next
      set({ pollIntervalMs: next })
      if (timer) clearTimeout(timer)
      timer = null
      armNext()
    },
  }
})
