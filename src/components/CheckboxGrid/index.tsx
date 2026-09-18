import { Box } from 'ink'
import { useMemo } from 'react'

import GridCell, { GridCellSlot } from './components/GridCell.tsx'
import { useCheckboxGrid } from './hooks/useCheckboxGrid.ts'
import { toGridRows } from './lib.ts'

type Props<T> = {
  items: readonly T[]
  /** 输入是否激活 (通常为处于选择态且无浮层弹窗) */
  isActive: boolean
  /** 网格列数 (至少为 1) */
  columnCount: number
  /** 列间距 (至少为 2) */
  columnGap: number
  /** 回车时回传当前勾选的条目 (至少一个才触发) */
  getKey: (item: T) => string
  getLabel: (item: T) => string
  getHint?: (item: T) => string | undefined
  onSubmit: (items: T[]) => void
}

export default function CheckboxGrid<T>(props: Props<T>) {
  const { items, columnCount, columnGap, isActive } = props
  const { getKey, getLabel, getHint, onSubmit } = props
  const { gridRef, cursor, selectedKeys, visibleRange } = useCheckboxGrid({
    items,
    getKey,
    columnCount,
    isActive,
    onSubmit,
  })
  const rows = useMemo(() => toGridRows(items, columnCount), [items, columnCount])

  return (
    <Box ref={gridRef} flexDirection="column" flexGrow={1} overflow="hidden">
      {rows.slice(visibleRange.start, visibleRange.end).map((row, rowOffset) => {
        const rowIndex = visibleRange.start + rowOffset
        return (
          <Box key={rowIndex} columnGap={columnGap}>
            {Array.from({ length: columnCount }, (_unused, colIndex) => {
              const item = row[colIndex]
              if (!item) return <GridCellSlot key={`empty-${colIndex}`} />

              const index = rowIndex * columnCount + colIndex
              const code = getKey(item)
              return (
                <GridCell
                  key={code}
                  label={getLabel(item)}
                  hint={getHint?.(item)}
                  selected={selectedKeys.has(code)}
                  cursor={isActive && index === cursor}
                />
              )
            })}
          </Box>
        )
      })}
    </Box>
  )
}
