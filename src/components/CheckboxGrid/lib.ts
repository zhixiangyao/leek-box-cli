import type { CursorDirection } from '../../lib/keys.ts'

/** 将条目按行优先切分为若干行, 每行最多 columns 个 */
export function toGridRows<T>(items: readonly T[], columns: number): T[][] {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns))
  }
  return rows
}

/** 方向键移动后的新光标下标, 越界时保持不动 */
export function nextCursor(cursor: number, total: number, direction: CursorDirection, columns: number): number {
  if (total <= 0) return 0
  const clamped = Math.min(Math.max(cursor, 0), total - 1)
  const column = clamped % columns
  if (direction === 'left') return column > 0 ? clamped - 1 : clamped
  if (direction === 'right') return column < columns - 1 && clamped + 1 < total ? clamped + 1 : clamped
  if (direction === 'up') return clamped - columns >= 0 ? clamped - columns : clamped
  // direction === 'down'
  return clamped + columns < total ? clamped + columns : clamped
}

/** 保证光标所在行落在可视窗口内, 返回受钳制的滚动偏移 (行) */
export function scrollForCursor(
  cursor: number,
  totalRows: number,
  scrollOffset: number,
  visibleRows: number,
  columns: number,
): number {
  const maxOffset = Math.max(0, totalRows - visibleRows)
  const cursorRow = Math.floor(Math.max(cursor, 0) / columns)
  let next = Math.min(Math.max(scrollOffset, 0), maxOffset)
  if (cursorRow < next) next = cursorRow
  else if (cursorRow >= next + visibleRows) next = cursorRow - visibleRows + 1
  return Math.min(Math.max(next, 0), maxOffset)
}

/**
 * 行滚动窗口 [start, end): 起点由 scrollOffset 决定 (越界钳制).
 * 行数不超过可视高度时展示全部.
 */
export function rowWindow(
  totalRows: number,
  scrollOffset: number,
  visibleRows: number,
): { start: number; end: number } {
  if (totalRows <= visibleRows) return { start: 0, end: totalRows }
  const maxStart = totalRows - visibleRows
  const start = Math.min(Math.max(scrollOffset, 0), maxStart)
  return { start, end: start + visibleRows }
}

/** 单元格最小宽度 (列): 容纳 `[x] 四字名称 (sh600000)` 并余 1 列, 列数取整后仍不至于让单元格截断 */
const MIN_CELL_WIDTH = 24

/** 内容区过窄时仍保持两列 */
const MIN_COLUMN_COUNT = 2

/** 内容区过宽时不再增加列数, 避免单元格被拉得过散 */
const MAX_COLUMN_COUNT = 8

/**
 * 按内容区宽度推导网格列数: 单元格等分内容区,
 * 取每格仍不小于 MIN_CELL_WIDTH 的最大列数.
 */
export function gridColumnCount(contentWidth: number, columnGap: number): number {
  const count = Math.floor((contentWidth + columnGap) / (MIN_CELL_WIDTH + columnGap))
  return Math.min(Math.max(count, MIN_COLUMN_COUNT), MAX_COLUMN_COUNT)
}
