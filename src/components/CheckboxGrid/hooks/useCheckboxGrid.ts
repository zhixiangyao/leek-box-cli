import { type DOMElement, useBoxMetrics, useInput } from 'ink'
import { useRef, useState } from 'react'

import { COLUMN_COUNT, type CursorDirection, nextCursor, rowWindow, scrollForCursor } from '../lib.ts'

type UseCheckboxGridParams<T> = {
  items: readonly T[]
  getKey: (item: T) => string
  isActive: boolean
  onSubmit: (items: T[]) => void
}

export function useCheckboxGrid<T>({ items, getKey, isActive, onSubmit }: UseCheckboxGridParams<T>) {
  const gridRef = useRef<DOMElement>(null)
  const boxMetrics = useBoxMetrics(gridRef)
  const [cursor, setCursor] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(() => new Set())

  const total = items.length
  const visibleRows = boxMetrics.hasMeasured ? Math.max(1, Math.floor(boxMetrics.height)) : 1
  const totalRows = Math.ceil(total / COLUMN_COUNT)
  const visibleRange = rowWindow(totalRows, scrollOffset, visibleRows)

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (key.leftArrow || key.rightArrow || key.upArrow || key.downArrow) {
        const direction: CursorDirection = key.leftArrow
          ? 'left'
          : key.rightArrow
            ? 'right'
            : key.upArrow
              ? 'up'
              : 'down'
        const cursorNext = nextCursor(cursor, total, direction)
        setCursor(cursorNext)
        setScrollOffset(scrollForCursor(cursorNext, totalRows, scrollOffset, Math.max(1, visibleRows)))
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
