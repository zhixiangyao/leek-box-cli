import { useInput, useWindowSize } from 'ink'
import { useEffect, useState } from 'react'

import { DEFAULT_VISIBLE } from '../../../components/ScrollBox.tsx'
import { TABLE_CHROME } from '../../../components/WindowSizeGuard.tsx'
import { useOverlayOpen } from '../../../hooks/useOverlayOpen.ts'
import { usePolling } from '../../../hooks/usePolling.ts'
import { scaleColumns, STOCK_LIST_COLUMNS } from '../../../lib/quoteTable.ts'
import { useDialogStockDetailStore } from '../../../stores/useDialogStockDetailStore.ts'
import { useSettingsStore } from '../../../stores/useSettingsStore.ts'
import { useStockListStore } from '../../../stores/useStockListStore.ts'

export function useStockList() {
  const { columns } = useWindowSize()
  const overlayOpen = useOverlayOpen()
  const pollIntervalMs = useSettingsStore((state) => state.quotePollIntervalMs)
  const step = useStockListStore((state) => state.step)
  const selectedCode = useStockListStore((state) => state.selectedCode)
  const scrollOffset = useStockListStore((state) => state.scrollOffset)
  const refreshQuotes = useStockListStore((state) => state.refreshQuotes)
  const moveSelection = useStockListStore((state) => state.moveSelection)
  const reset = useStockListStore((state) => state.reset)
  const open = useDialogStockDetailStore((state) => state.open)
  const contentColumns = columns - TABLE_CHROME - (STOCK_LIST_COLUMNS.length - 1)
  const scaledColumns = scaleColumns(STOCK_LIST_COLUMNS, contentColumns)
  const [visible, setVisible] = useState(DEFAULT_VISIBLE)
  const [remainingCount, setRemainingCount] = useState(0)
  const { refresh } = usePolling(refreshQuotes, { intervalMs: pollIntervalMs })

  useEffect(() => () => reset(), [reset])

  function handlesVisibleChange(value: number) {
    setVisible(value)
  }

  function handlesWindowChange(value: number) {
    setRemainingCount(value)
  }

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (input === 'r') {
        refresh()
      } else {
        if (step.type !== 'table' || !selectedCode) return

        if (key.return) {
          const selectedRow = step.rows.find((item) => item.code === selectedCode)
          if (selectedRow) open(selectedRow.code, selectedRow.name)
        } else if (key.upArrow) {
          moveSelection(-1, visible)
        } else if (key.downArrow) {
          moveSelection(1, visible)
        }
      }
    },
    { isActive: !overlayOpen.open },
  )

  return { step, selectedCode, scrollOffset, scaledColumns, remainingCount, handlesVisibleChange, handlesWindowChange }
}
