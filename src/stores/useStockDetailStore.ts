import { create } from 'zustand'

import { fetchIntraday, type IntradayPoint } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'

/** 详情弹窗分时数据轮询间隔 (看板 5s 轮询仍负责现价, 分时历史数据 30s 即可) */
export const INTRADAY_POLL_INTERVAL_MS = 30_000

type StockDetailState = {
  /** 详情弹窗开关: null = 关闭 */
  code: string | null
  /** 打开时快照 (缺失行/行情异常时标题仍可用) */
  name: string
  status: 'loading' | 'ready' | 'error'
  points: IntradayPoint[]
  errorMessage?: string
  open: (code: string, name: string) => void
  close: () => void
}

// 轮询的非响应式状态: 模块级变量, store 只承载展示数据 (与 useDashboardStore 同模式)
let timer: ReturnType<typeof setTimeout> | null = null
let inFlight = false
let cancelled = false

/** 股票详情弹窗 store: 打开时拉取今日分时并 30s 轮询, 自调度 setTimeout + inFlight 守卫, 失败自愈 */
export const useStockDetailStore = create<StockDetailState>()((set, get) => {
  const fetchOnce = async (code: string) => {
    if (inFlight) return
    inFlight = true
    try {
      const points = await fetchIntraday(code)
      // 已关闭或已切换到别的股票: 丢弃过期结果
      if (cancelled || get().code !== code) return
      set({ status: 'ready', points })
    } catch (err) {
      if (cancelled || get().code !== code) return
      set({ status: 'error', errorMessage: errorMessage(err) })
    } finally {
      inFlight = false
    }
  }

  // 唯一排程点: 计时器触发 -> fetch -> 再排程 (失败也继续轮询自愈)
  const armNext = () => {
    if (cancelled || timer || !get().code) return
    timer = setTimeout(() => {
      timer = null
      if (cancelled) return
      const { code } = get()
      if (!code) return
      void fetchOnce(code).finally(() => {
        if (cancelled) return
        armNext()
      })
    }, INTRADAY_POLL_INTERVAL_MS)
  }

  return {
    code: null,
    name: '',
    status: 'loading',
    points: [],
    open: (code, name) => {
      cancelled = false
      set({ code, name, status: 'loading', points: [], errorMessage: undefined })
      void fetchOnce(code)
      armNext()
    },
    close: () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      timer = null
      set({ code: null })
    },
  }
})
