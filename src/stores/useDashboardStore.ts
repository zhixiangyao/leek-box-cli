import { create } from 'zustand'

import { fetchQuotes, type Quote } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'
import { loadWatchlist } from '../lib/watchlist.ts'

export const DEFAULT_POLL_INTERVAL_MS = 5000
export const MIN_POLL_INTERVAL_MS = 1000
export const MAX_POLL_INTERVAL_MS = 60_000
export const POLL_INTERVAL_STEP_MS = 500

export type DashboardStep =
  | { type: 'loading' }
  | { type: 'empty' }
  | { type: 'error'; message: string } // 首次拉取失败 (无旧数据可展示)
  | {
      type: 'table'
      quotes: Quote[]
      missing: { code: string; name: string }[] // 接口没返回的股票
      updatedAt: string // HH:MM:SS, 取各股最新
      errorLine?: string // 轮询失败时保留旧表格并内联提示
    }

type DashboardState = {
  step: DashboardStep
  pollIntervalMs: number
  /** 选中行索引 (quotes + missing 拼接的显示行序列) */
  selectedIndex: number
  /** 滚动窗口起点 (拼接行序列): 窗口不跟随选中行, 选中行触到窗口边缘才滚动 */
  viewStart: number
  /** 进入看板页时启动轮询 */
  start: () => void
  /** 离开看板页时停止轮询 */
  stop: () => void
  /** 手动立即刷新 (inFlight 时忽略) */
  refreshNow: () => void
  /** 调整轮询间隔 (500ms 步进, 夹在 [1s, 60s]); 重置等待期让新间隔立即生效 */
  adjustInterval: (deltaMs: number) => void
  /** 上下移动选中行 (越界钳制, 选中行触到窗口边缘才滚动) */
  moveSelection: (delta: 1 | -1, visible: number) => void
}

// 轮询循环的非响应式状态: 排程/守卫用模块级变量, store 只承载展示数据
let inFlight = false
let timer: ReturnType<typeof setTimeout> | null = null
let pollInterval = DEFAULT_POLL_INTERVAL_MS
let cancelled = false

const formatClock = (timestamp: string) =>
  `${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}`

/** 股票涨跌看板 store: 轮询腾讯行情 (默认 5s, -/+ 可调), 自调度 setTimeout + inFlight 守卫避免重叠 */
export const useDashboardStore = create<DashboardState>()((set, get) => {
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
      // 保留旧表格 + 内联错误继续轮询自愈, 否则进 error 步
      set((state) =>
        state.step.type === 'table'
          ? { step: { ...state.step, errorLine: message } }
          : { step: { type: 'error', message } },
      )
    } finally {
      inFlight = false
    }
  }

  // 唯一排程点: 计时器触发 -> fetch -> 再排程 (有计时器等待时不重复排)
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
    selectedIndex: 0,
    viewStart: 0,
    moveSelection: (delta: 1 | -1, visible: number) => {
      const { step, selectedIndex, viewStart } = get()
      if (step.type !== 'table') return
      const rowCount = step.quotes.length + step.missing.length
      if (rowCount === 0) return
      const next = Math.min(Math.max(selectedIndex + delta, 0), rowCount - 1)
      // 窗口只在选中行触到移动方向的窗口边缘时才滚动; 否则保持原位 (从末尾往上选时视图不变)
      let nextStart = viewStart
      if (delta === 1 && next >= viewStart + visible) nextStart = next - visible + 1
      else if (delta === -1 && next < viewStart) nextStart = next
      const maxStart = Math.max(0, rowCount - visible)
      set({ selectedIndex: next, viewStart: Math.min(Math.max(nextStart, 0), maxStart) })
    },
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
