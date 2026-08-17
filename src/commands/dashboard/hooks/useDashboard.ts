import { useInput } from 'ink'
import { useEffect } from 'react'

import { POLL_INTERVAL_STEP_MS, useDashboardStore } from '../../../stores/useDashboardStore.ts'

/**
 * 看板页副作用: 轮询生命周期跟随页面挂载 (进入启动, 离开停止, store 常驻必须显式控制),
 * 以及全局快捷键: r 立即刷新, -/+ 调整轮询间隔 (1s 步进).
 */
export function useDashboardPage(isActive: boolean) {
  const start = useDashboardStore((state) => state.start)
  const stop = useDashboardStore((state) => state.stop)
  const refreshNow = useDashboardStore((state) => state.refreshNow)
  const adjustInterval = useDashboardStore((state) => state.adjustInterval)

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (input === 'r') {
        refreshNow()
      } else if (input === '-') {
        adjustInterval(-POLL_INTERVAL_STEP_MS)
      } else if (input === '+') {
        adjustInterval(POLL_INTERVAL_STEP_MS)
      }
    },
    { isActive },
  )
}
