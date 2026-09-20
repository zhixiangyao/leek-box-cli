import { type DOMElement, useBoxMetrics, useInput } from 'ink'
import { useRef, useState } from 'react'

import { keyDirection } from '../../../lib/keys.ts'
import { nextCursor, rowWindow, scrollForCursor } from '../lib.ts'

type UseCheckboxGridParams<T> = {
  items: readonly T[]
  getKey: (item: T) => string
  columnCount: number
  isActive: boolean
  onSubmit: (items: T[]) => void
}

export function useCheckboxGrid<T>({ items, getKey, columnCount, isActive, onSubmit }: UseCheckboxGridParams<T>) {
  const gridRef = useRef<DOMElement>(null)
  const boxMetrics = useBoxMetrics(gridRef)
  const [cursor, setCursor] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(() => new Set())

  const total = items.length
  const visibleRows = boxMetrics.hasMeasured ? Math.max(1, Math.floor(boxMetrics.height)) : 1
  const totalRows = Math.ceil(total / columnCount)
  // 先按光标钳制一次: 终端宽度变化会改变列数, 光标所在行随之变化, 否则光标会停在可视窗口之外
  const visibleRange = rowWindow(
    totalRows,
    scrollForCursor(cursor, totalRows, scrollOffset, visibleRows, columnCount),
    visibleRows,
  )

  useInput(
    (input, key) => {
      if (key.ctrl) return
      const direction = keyDirection(input, key)
      if (direction) {
        const cursorNext = nextCursor(cursor, total, direction, columnCount)
        setCursor(cursorNext)
        setScrollOffset(scrollForCursor(cursorNext, totalRows, scrollOffset, Math.max(1, visibleRows), columnCount))
      } else if (input === ' ') {
        const item = items[cursor]
        if (!item) return
        const code = getKey(item)
        setSelectedKeys((previous) => {
          const draft = new Set(previous)
          if (draft.has(code)) draft.delete(code)
          else draft.add(code)
          return draft
        })
      } else if (key.return) {
        const selected = items.filter((item) => selectedKeys.has(getKey(item)))
        if (selected.length > 0) onSubmit(selected)
      }
    },
    { isActive },
  )

  return { gridRef, cursor, selectedKeys, visibleRange }
}
