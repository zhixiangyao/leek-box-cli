import { useInput } from 'ink'
import { useEffect } from 'react'

import { useOverlayOpen } from '../../../hooks/useOverlayOpen.ts'
import { POLL_INTERVAL_STEP_MS, useDashboardStore } from '../../../stores/useDashboardStore.ts'
import { useStockDetailStore } from '../../../stores/useStockDetailStore.ts'

export function useDashboardPage() {
  const dashboardStore = useDashboardStore()
  const overlayOpen = useOverlayOpen()
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
    { isActive: !overlayOpen },
  )
}
