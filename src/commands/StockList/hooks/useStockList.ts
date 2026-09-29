import { useInput, useWindowSize } from 'ink'
import { useEffect, useState } from 'react'

import { DEFAULT_VISIBLE } from '../../../components/ScrollBox.tsx'
import { TABLE_CHROME } from '../../../components/WindowSizeGuard.tsx'
import { useOverlayOpen } from '../../../hooks/useOverlayOpen.ts'
import { usePolling } from '../../../hooks/usePolling.ts'
import { useTranslation } from '../../../hooks/useTranslation.ts'
import { keyDirection } from '../../../lib/keys.ts'
import { scaleColumns, stockListColumns } from '../../../lib/quoteTable.ts'
import { useDialogStockDetailStore } from '../../../stores/useDialogStockDetailStore.ts'
import { useSettingsStore } from '../../../stores/useSettingsStore.ts'
import { displayedRows, useStockListStore } from '../../../stores/useStockListStore.ts'

export function useStockList() {
  const { columns } = useWindowSize()
  const overlayOpen = useOverlayOpen()
  const { locale } = useTranslation()
  const pollIntervalMs = useSettingsStore((state) => state.quotePollIntervalMs)
  const step = useStockListStore((state) => state.step)
  const sortMode = useStockListStore((state) => state.sortMode)
  const selectedCode = useStockListStore((state) => state.selectedCode)
  const scrollOffset = useStockListStore((state) => state.scrollOffset)
  const refreshQuotes = useStockListStore((state) => state.refreshQuotes)
  const moveSelection = useStockListStore((state) => state.moveSelection)
  const cycleSortMode = useStockListStore((state) => state.cycleSortMode)
  const reset = useStockListStore((state) => state.reset)
  const open = useDialogStockDetailStore((state) => state.open)
  const columnsForLocale = stockListColumns(locale)
  const contentWidth = columns - TABLE_CHROME - (columnsForLocale.length - 1)
  const scaledColumns = scaleColumns(columnsForLocale, contentWidth)
  // step.rows 是自选股文件顺序, 看板渲染的是按 sortMode 排好的显示顺序
  const rows = displayedRows(step, sortMode)
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
      } else if (input === 's') {
        cycleSortMode()
      } else {
        if (step.type !== 'table' || !selectedCode) return
        const direction = keyDirection(input, key)

        if (key.return) {
          const selectedRow = rows.find((item) => item.code === selectedCode)
          if (selectedRow) open(selectedRow.code)
        } else if (direction === 'up') {
          moveSelection(-1, visible)
        } else if (direction === 'down') {
          moveSelection(1, visible)
        }
      }
    },
    { isActive: !overlayOpen.open },
  )

  return {
    step,
    /** 按 sortMode 排好序的行情行, 与 moveSelection 的选中行索引同一顺序 */
    rows,
    sortMode,
    selectedCode,
    scrollOffset,
    scaledColumns,
    remainingCount,
    handlesVisibleChange,
    handlesWindowChange,
  }
}
