import { type DOMElement, useBoxMetrics, useInput } from 'ink'
import { useEffect, useRef } from 'react'

import { useOverlayOpen } from '../../../hooks/useOverlayOpen.ts'
import { POLL_INTERVAL_STEP_MS, useDashboardStore } from '../../../stores/useDashboardStore.ts'
import { useStockDetailStore } from '../../../stores/useStockDetailStore.ts'
import { tableSlices, type TableSliceRange } from '../lib/table.ts'

export function useDashboardPage() {
  const rowsRef = useRef<DOMElement>(null)
  const boxMetrics = useBoxMetrics(rowsRef)
  const dashboardStore = useDashboardStore()
  const overlayOpen = useOverlayOpen()
  const { start, stop } = dashboardStore
  const visible = boxMetrics.hasMeasured ? Math.max(1, Math.floor(boxMetrics.height)) : 1
  const slices: TableSliceRange =
    dashboardStore.step.type === 'table'
      ? tableSlices(
          visible,
          dashboardStore.step.quotes.length,
          dashboardStore.step.missing.length,
          dashboardStore.viewStart,
        )
      : { quoteStart: 0, quoteEnd: 0, missingStart: 0, missingEnd: 0 }

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (key.upArrow) {
        dashboardStore.moveSelection(-1, visible)
      } else if (key.downArrow) {
        dashboardStore.moveSelection(1, visible)
      } else if (key.return) {
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

  return { slices, rowsRef }
}
