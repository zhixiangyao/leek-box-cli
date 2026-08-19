import { useInput, useWindowSize } from 'ink'
import { useEffect } from 'react'

import { useOverlayOpen } from '../../../hooks/useOverlayOpen.ts'
import { POLL_INTERVAL_STEP_MS, useDashboardStore } from '../../../stores/useDashboardStore.ts'
import { useStockDetailStore } from '../../../stores/useStockDetailStore.ts'
import { tableSlices, visibleRowCount, type TableSliceRange } from '../lib/table.ts'

export function useDashboardPage() {
  const dashboardStore = useDashboardStore()
  const overlayOpen = useOverlayOpen()
  const { start, stop, step, viewStart } = dashboardStore
  const { rows } = useWindowSize()
  // 滚动窗口是键盘 (moveSelection 的 visible) 与渲染 (tableSlices) 共用的视图计算, 收口在 hook 算好统一返回
  let slices: TableSliceRange = { quoteStart: 0, quoteEnd: 0, missingStart: 0, missingEnd: 0 }
  const visible = visibleRowCount(rows, step.type === 'table' ? step.errorLine : undefined)

  if (step.type === 'table') {
    slices = tableSlices(rows, step.errorLine, step.quotes.length, step.missing.length, viewStart)
  }

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (key.upArrow) {
        dashboardStore.moveSelection(-1, visible)
      } else if (key.downArrow) {
        dashboardStore.moveSelection(1, visible)
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

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return { slices }
}
