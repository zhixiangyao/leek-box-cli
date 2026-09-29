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
import { useStockListStore } from '../../../stores/useStockListStore.ts'
import {
  anchoredScrollOffset,
  clampSelection,
  displayedRows,
  rowIndex,
  scrollOffsetAfterReorder,
  SORT_MODE_CYCLE,
  type StockListSortMode,
} from '../lib.ts'

export function useStockList() {
  const { columns } = useWindowSize()
  const overlayOpen = useOverlayOpen()
  const { locale } = useTranslation()
  const pollIntervalMs = useSettingsStore((state) => state.quotePollIntervalMs)
  const step = useStockListStore((state) => state.step)
  const refreshQuotes = useStockListStore((state) => state.refreshQuotes)
  const reset = useStockListStore((state) => state.reset)
  const open = useDialogStockDetailStore((state) => state.open)
  const [sortMode, setSortMode] = useState<StockListSortMode>('default')
  const [selectedCode, setSelectedCode] = useState<string>()
  const [scrollOffset, setScrollOffset] = useState(0)
  const [visible, setVisible] = useState(DEFAULT_VISIBLE)
  const columnsForLocale = stockListColumns(locale)
  const contentWidth = columns - TABLE_CHROME - (columnsForLocale.length - 1)
  const scaledColumns = scaleColumns(columnsForLocale, contentWidth)
  const rows = displayedRows(step, sortMode)
  // 没显示出来的行数: 按可视高度算, 从窗口末尾往前数会在窗口贴到列表底部时变成 0
  const remainingCount = Math.max(0, rows.length - visible)

  async function refreshAndAnchor(signal: AbortSignal) {
    await refreshQuotes(signal)
    const nextRows = displayedRows(useStockListStore.getState().step, sortMode)
    if (nextRows.length === 0) {
      setSelectedCode(undefined)
      setScrollOffset(0)
      return
    }
    const previousIndex = rowIndex(rows, selectedCode)
    const preservedIndex = selectedCode ? nextRows.findIndex((row) => row.code === selectedCode) : -1
    const nextIndex = preservedIndex >= 0 ? preservedIndex : clampSelection(previousIndex, nextRows.length)
    setSelectedCode(nextRows[nextIndex]?.code)
    setScrollOffset(scrollOffsetAfterReorder(previousIndex, nextIndex, scrollOffset))
  }

  const { refresh } = usePolling(refreshAndAnchor, { intervalMs: pollIntervalMs })

  function handlesVisibleChange(value: number) {
    setVisible(value)
  }

  function moveSelection(delta: 1 | -1) {
    const currentIndex = rowIndex(rows, selectedCode)
    const nextIndex = clampSelection(currentIndex + delta, rows.length)
    setSelectedCode(rows[nextIndex]?.code)
    setScrollOffset(anchoredScrollOffset(delta, currentIndex, rows.length, scrollOffset, visible))
  }

  function cycleSortMode() {
    const nextSortMode = SORT_MODE_CYCLE[sortMode]
    // 换顺序后让选中行停在窗口里的同一行, 否则按一次 s 选中行就跳出视口
    const previousIndex = rowIndex(rows, selectedCode)
    const nextIndex = rowIndex(displayedRows(step, nextSortMode), selectedCode)
    setSortMode(nextSortMode)
    setScrollOffset(scrollOffsetAfterReorder(previousIndex, nextIndex, scrollOffset))
  }

  useEffect(() => () => reset(), [reset])

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
          moveSelection(-1)
        } else if (direction === 'down') {
          moveSelection(1)
        }
      }
    },
    { isActive: !overlayOpen.open },
  )

  return {
    step,
    rows,
    sortMode,
    selectedCode,
    scrollOffset,
    scaledColumns,
    remainingCount,
    handlesVisibleChange,
  }
}
