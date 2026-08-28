export type CursorDirection = 'left' | 'right' | 'up' | 'down'

/** 网格列数 */
export const COLUMN_COUNT = 3

/** 将条目按行优先切分为若干行, 每行最多 columns 个 */
export function toGridRows<T>(items: readonly T[], columns = COLUMN_COUNT): T[][] {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns))
  }
  return rows
}

/** 方向键移动后的新光标下标, 越界时保持不动 */
export function nextCursor(cursor: number, total: number, direction: CursorDirection): number {
  if (total <= 0) return 0
  const clamped = Math.min(Math.max(cursor, 0), total - 1)
  const column = clamped % COLUMN_COUNT
  if (direction === 'left') return column > 0 ? clamped - 1 : clamped
  if (direction === 'right') return column < COLUMN_COUNT - 1 && clamped + 1 < total ? clamped + 1 : clamped
  if (direction === 'up') return clamped - COLUMN_COUNT >= 0 ? clamped - COLUMN_COUNT : clamped
  // direction === 'down'
  return clamped + COLUMN_COUNT < total ? clamped + COLUMN_COUNT : clamped
}

/** 保证光标所在行落在可视窗口内, 返回受钳制的滚动偏移 (行) */
export function scrollForCursor(cursor: number, totalRows: number, scrollOffset: number, visibleRows: number): number {
  const maxOffset = Math.max(0, totalRows - visibleRows)
  const cursorRow = Math.floor(Math.max(cursor, 0) / COLUMN_COUNT)
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
