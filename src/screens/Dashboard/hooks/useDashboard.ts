import { useInput } from 'ink'
import { useEffect } from 'react'

import { POLL_INTERVAL_STEP_MS, useDashboardStore } from '../../../stores/useDashboardStore.ts'
import { useMenuStore } from '../../../stores/useMenuStore.ts'
import { useStockDetailStore } from '../../../stores/useStockDetailStore.ts'

/**
 * 看板页副作用: 轮询生命周期跟随页面挂载 (进入启动, 离开停止, store 常驻必须显式控制),
 * 以及全局快捷键: ↑/↓ 移动选中行, 回车打开详情弹窗, r 立即刷新, -/+ 调整轮询间隔 (1s 步进).
 * 详情弹窗打开时全部静默 (esc/q 由 app.tsx 全局守卫).
 */
export function useDashboardPage() {
  const dashboardStore = useDashboardStore()
  const menuStore = useMenuStore()
  const stockDetailStore = useStockDetailStore()
  const { start, stop } = dashboardStore

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (key.upArrow) {
        dashboardStore.moveSelection(-1)
      } else if (key.downArrow) {
        dashboardStore.moveSelection(1)
      } else if (key.return) {
        // 按选中行在 quotes + missing 显示行序列上解析出股票并打开详情 (store 间不互相 import, 由 hook 接线)
        const { step, selectedIndex } = useDashboardStore.getState()
        if (step.type !== 'table') return
        const rowCount = step.quotes.length + step.missing.length
        if (selectedIndex >= rowCount) return
        if (selectedIndex < step.quotes.length) {
          const quote = step.quotes[selectedIndex]!
          useStockDetailStore.getState().open(quote.code, quote.name)
        } else {
          const entry = step.missing[selectedIndex - step.quotes.length]!
          useStockDetailStore.getState().open(entry.code, entry.name)
        }
      } else if (input === 'r') {
        dashboardStore.refreshNow()
      } else if (input === '-') {
        dashboardStore.adjustInterval(-POLL_INTERVAL_STEP_MS)
      } else if (input === '+') {
        dashboardStore.adjustInterval(POLL_INTERVAL_STEP_MS)
      }
    },
    { isActive: !menuStore.open && !stockDetailStore.code },
  )
}
