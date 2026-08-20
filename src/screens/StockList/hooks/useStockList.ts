import { type DOMElement, useBoxMetrics, useInput } from 'ink'
import { useEffect, useRef } from 'react'

import { useOverlayOpen } from '../../../hooks/useOverlayOpen.ts'
import { usePolling } from '../../../hooks/usePolling.ts'
import { useStockDetailStore } from '../../../stores/useStockDetailStore.ts'
import {
  MAX_POLL_INTERVAL_MS,
  MIN_POLL_INTERVAL_MS,
  POLL_INTERVAL_STEP_MS,
  useStockListStore,
} from '../../../stores/useStockListStore.ts'
import { visibleWindow } from '../lib.ts'

export function useStockListPage() {
  const rowsRef = useRef<DOMElement>(null)
  const boxMetrics = useBoxMetrics(rowsRef)
  const stockListStore = useStockListStore()
  const overlayOpen = useOverlayOpen()
  const visible = boxMetrics.hasMeasured ? Math.max(1, Math.floor(boxMetrics.height)) : 1
  const window =
    stockListStore.step.type === 'table'
      ? visibleWindow(stockListStore.step.rows.length, stockListStore.scrollOffset, visible)
      : { start: 0, end: 0 }

  useEffect(() => {
    useStockListStore.setState({ step: { type: 'loading' } })
  }, [])

  const { refresh } = usePolling((signal) => useStockListStore.getState().refreshQuotes(signal), {
    intervalMs: stockListStore.pollIntervalMs,
  })

  const adjustPollInterval = (deltaMs: number) => {
    const current = useStockListStore.getState().pollIntervalMs
    const next = Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, current + deltaMs))
    if (next !== current) useStockListStore.setState({ pollIntervalMs: next })
  }

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (key.upArrow) {
        stockListStore.moveSelection(-1, visible)
      } else if (key.downArrow) {
        stockListStore.moveSelection(1, visible)
      } else if (key.return) {
        const { step, selectedCode } = useStockListStore.getState()
        if (step.type !== 'table' || !selectedCode) return
        const row = step.rows.find((item) => item.code === selectedCode)
        if (row) useStockDetailStore.getState().open(row.code, row.name)
      } else if (input === 'r') {
        refresh()
      } else if (input === '-') {
        adjustPollInterval(-POLL_INTERVAL_STEP_MS)
      } else if (input === '+') {
        adjustPollInterval(POLL_INTERVAL_STEP_MS)
      }
    },
    { isActive: !overlayOpen },
  )

  return { window, rowsRef }
}
