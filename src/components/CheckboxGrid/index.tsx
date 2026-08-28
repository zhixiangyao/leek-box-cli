import { Box } from 'ink'

import GridCell, { GridCellSlot } from './components/GridCell.tsx'
import { useCheckboxGrid } from './hooks/useCheckboxGrid.ts'
import { COLUMN_COUNT, toGridRows } from './lib.ts'

type Props<T> = {
  items: readonly T[]
  getKey: (item: T) => string
  getLabel: (item: T) => string
  getHint?: (item: T) => string | undefined
  /** 输入是否激活 (通常为处于选择态且无浮层弹窗) */
  isActive: boolean
  /** 回车时回传当前勾选的条目 (至少一个才触发) */
  onSubmit: (items: T[]) => void
}

export default function CheckboxGrid<T>(props: Props<T>) {
  const { items, getKey, getLabel, getHint, isActive, onSubmit } = props
  const { gridRef, cursor, selectedKeys, visibleRange } = useCheckboxGrid({ items, getKey, isActive, onSubmit })
  const rows = toGridRows(items)

  return (
    <Box ref={gridRef} flexDirection="column" flexGrow={1} overflow="hidden">
      {rows.slice(visibleRange.start, visibleRange.end).map((row, rowOffset) => {
        const rowIndex = visibleRange.start + rowOffset
        return (
          <Box key={rowIndex} columnGap={2}>
            {Array.from({ length: COLUMN_COUNT }, (_unused, colIndex) => {
              const item = row[colIndex]
              if (!item) return <GridCellSlot key={`empty-${colIndex}`} />

              const index = rowIndex * COLUMN_COUNT + colIndex
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
