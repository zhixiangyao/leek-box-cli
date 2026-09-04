import { type DOMElement, useBoxMetrics, useInput } from 'ink'
import { useEffect, useRef } from 'react'

import { useOverlayOpen } from '../../../hooks/useOverlayOpen.ts'
import { usePolling } from '../../../hooks/usePolling.ts'
import { useDialogStockDetailStore } from '../../../stores/useDialogStockDetailStore.ts'
import { useSettingsStore } from '../../../stores/useSettingsStore.ts'
import { useStockListStore } from '../../../stores/useStockListStore.ts'
import { visibleWindow } from '../lib.ts'

export function useStockList() {
  const rowsRef = useRef<DOMElement>(null)
  const boxMetrics = useBoxMetrics(rowsRef)
  const step = useStockListStore((state) => state.step)
  const selectedCode = useStockListStore((state) => state.selectedCode)
  const scrollOffset = useStockListStore((state) => state.scrollOffset)
  const pollIntervalMs = useSettingsStore((state) => state.quotePollIntervalMs)
  const moveSelection = useStockListStore((state) => state.moveSelection)
  const overlayOpen = useOverlayOpen()
  const visible = boxMetrics.hasMeasured ? Math.max(1, Math.floor(boxMetrics.height)) : 1
  const window = step.type === 'table' ? visibleWindow(step.rows.length, scrollOffset, visible) : { start: 0, end: 0 }

  useEffect(() => {
    useStockListStore.setState({ step: { type: 'loading' } })
  }, [])

  const { refresh } = usePolling((signal) => useStockListStore.getState().refreshQuotes(signal), {
    intervalMs: pollIntervalMs,
  })

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (key.upArrow) {
        moveSelection(-1, visible)
      } else if (key.downArrow) {
        moveSelection(1, visible)
      } else if (key.return) {
        const current = useStockListStore.getState()
        if (current.step.type !== 'table' || !current.selectedCode) return
        const row = current.step.rows.find((item) => item.code === current.selectedCode)
        if (row) useDialogStockDetailStore.getState().open(row.code, row.name)
      } else if (input === 'r') {
        refresh()
      }
    },
    { isActive: !overlayOpen.open },
  )

  return { rowsRef, step, selectedCode, window }
}
