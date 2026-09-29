import { useInput, useWindowSize } from 'ink'
import { useEffect, useRef, useState } from 'react'

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
  clampSelection,
  displayedRows,
  rowIndex,
  scrollOffsetToReveal,
  SORT_MODE_CYCLE,
  visibleWindow,
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
  // gg 的第一键: 只决定下一个按键怎么解释, 不参与渲染, 因此用 ref 而不是 state
  const gPrefix = useRef(false)
  const columnsForLocale = stockListColumns(locale)
  const contentWidth = columns - TABLE_CHROME - (columnsForLocale.length - 1)
  const scaledColumns = scaleColumns(columnsForLocale, contentWidth)
  const rows = displayedRows(step, sortMode)
  // 右上角的条数是窗口下面还有几行, 因此滑到底部时会变成 0 (显示 0, 不隐藏);
  // 列表整个放得下时没有这个信息, 用 undefined 表示不显示
  const remainingCount =
    rows.length > visible ? rows.length - visibleWindow(rows.length, scrollOffset, visible).end : undefined

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
    setScrollOffset(scrollOffsetToReveal(nextIndex, nextRows.length, scrollOffset, visible))
  }

  const { refresh } = usePolling(refreshAndAnchor, { intervalMs: pollIntervalMs })

  function handlesVisibleChange(value: number) {
    setVisible(value)
  }

  /** 选中某个下标 (越界钳制, 空列表不动): 方向键与 gg/G 都经它落地, 视口规则也只有一个 */
  function selectIndex(index: number) {
    if (rows.length === 0) return
    const nextIndex = clampSelection(index, rows.length)
    setSelectedCode(rows[nextIndex]?.code)
    setScrollOffset(scrollOffsetToReveal(nextIndex, rows.length, scrollOffset, visible))
  }

  function moveSelection(delta: 1 | -1) {
    selectIndex(rowIndex(rows, selectedCode) + delta)
  }

  function cycleSortMode() {
    const nextSortMode = SORT_MODE_CYCLE[sortMode]
    const nextIndex = rowIndex(displayedRows(step, nextSortMode), selectedCode)
    setSortMode(nextSortMode)
    setScrollOffset(scrollOffsetToReveal(nextIndex, rows.length, scrollOffset, visible))
  }

  useEffect(() => () => reset(), [reset])

  // 浮层打开时本 hook 收不到按键, gg 的收尾键也就到不了这里: 前缀随即作废,
  // 否则关掉菜单后按一个 g 就会跳走 (用户按的是两件不相干的事)
  useEffect(() => {
    if (overlayOpen.open) gPrefix.current = false
  }, [overlayOpen.open])

  useInput(
    (input, key) => {
      if (key.ctrl) return

      // gg 是两键序列: 第一键只置前缀, 紧跟的第二个 g 才跳顶部, 其余按键让序列从零开始
      const wasGPrefix = gPrefix.current
      gPrefix.current = false

      if (input === 'g') {
        if (wasGPrefix) selectIndex(0)
        else gPrefix.current = true
        return
      }

      if (input === 'G') {
        selectIndex(rows.length - 1)
        return
      }

      if (input === 'r') {
        refresh()
        return
      }

      if (input === 's') {
        cycleSortMode()
        return
      }

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
