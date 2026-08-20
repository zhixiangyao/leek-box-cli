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
import { tableSlices, type TableSliceRange } from '../lib.ts'

export function useStockListPage() {
  const rowsRef = useRef<DOMElement>(null)
  const boxMetrics = useBoxMetrics(rowsRef)
  const stockListStore = useStockListStore()
  const overlayOpen = useOverlayOpen()
  const visible = boxMetrics.hasMeasured ? Math.max(1, Math.floor(boxMetrics.height)) : 1
  const slices: TableSliceRange =
    stockListStore.step.type === 'table'
      ? tableSlices(
          visible,
          stockListStore.step.quotes.length,
          stockListStore.step.missing.length,
          stockListStore.scrollOffset,
        )
      : { quoteStart: 0, quoteEnd: 0, missingStart: 0, missingEnd: 0 }

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
        const { step, selectedIndex } = useStockListStore.getState()
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
        refresh()
      } else if (input === '-') {
        adjustPollInterval(-POLL_INTERVAL_STEP_MS)
      } else if (input === '+') {
        adjustPollInterval(POLL_INTERVAL_STEP_MS)
      }
    },
    { isActive: !overlayOpen },
  )

  return { slices, rowsRef }
}
