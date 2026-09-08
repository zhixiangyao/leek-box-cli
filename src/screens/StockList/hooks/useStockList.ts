import { type DOMElement, useBoxMetrics, useInput, useWindowSize } from 'ink'
import { useEffect, useRef } from 'react'

import { TABLE_CHROME } from '../../../components/WindowSizeGuard.tsx'
import { useOverlayOpen } from '../../../hooks/useOverlayOpen.ts'
import { usePolling } from '../../../hooks/usePolling.ts'
import { scaleColumns, STOCK_LIST_COLUMNS } from '../../../lib/quoteTable.ts'
import { useDialogStockDetailStore } from '../../../stores/useDialogStockDetailStore.ts'
import { useSettingsStore } from '../../../stores/useSettingsStore.ts'
import { useStockListStore } from '../../../stores/useStockListStore.ts'
import { visibleWindow } from '../lib.ts'

export function useStockList() {
  const rowsRef = useRef<DOMElement>(null)
  const boxMetrics = useBoxMetrics(rowsRef)
  const { columns } = useWindowSize()
  const pollIntervalMs = useSettingsStore((state) => state.quotePollIntervalMs)
  const step = useStockListStore((state) => state.step)
  const selectedCode = useStockListStore((state) => state.selectedCode)
  const scrollOffset = useStockListStore((state) => state.scrollOffset)
  const refreshQuotes = useStockListStore((state) => state.refreshQuotes)
  const moveSelection = useStockListStore((state) => state.moveSelection)
  const open = useDialogStockDetailStore((state) => state.open)
  const overlayOpen = useOverlayOpen()
  const visible = boxMetrics.hasMeasured ? Math.max(1, Math.floor(boxMetrics.height)) : 1
  const window = step.type === 'table' ? visibleWindow(step.rows.length, scrollOffset, visible) : { start: 0, end: 0 }
  const contentColumns = columns - TABLE_CHROME - (STOCK_LIST_COLUMNS.length - 1)
  const scaledColumns = scaleColumns(STOCK_LIST_COLUMNS, contentColumns)

  useEffect(() => {
    useStockListStore.setState({ step: { type: 'loading' } })
  }, [])

  const { refresh } = usePolling(refreshQuotes, { intervalMs: pollIntervalMs })

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (key.upArrow) {
        moveSelection(-1, visible)
      } else if (key.downArrow) {
        moveSelection(1, visible)
      } else if (key.return) {
        if (step.type !== 'table' || !selectedCode) return
        const row = step.rows.find((item) => item.code === selectedCode)
        if (row) open(row.code, row.name)
      } else if (input === 'r') {
        refresh()
      }
    },
    { isActive: !overlayOpen.open },
  )

  return { rowsRef, step, scaledColumns, selectedCode, window }
}
