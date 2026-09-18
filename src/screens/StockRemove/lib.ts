import { TABLE_CHROME } from '../../components/WindowSizeGuard.tsx'

/** 单元格最小宽度 (列): 容纳 `[x] 四字名称 (sh600000)` 并余 1 列, 列数取整后仍不至于让单元格截断 */
const MIN_CELL_WIDTH = 24

/** 终端过窄时仍保持两列 */
const MIN_COLUMN_COUNT = 2

/** 终端过宽时不再增加列数, 避免单元格被拉得过散 */
const MAX_COLUMN_COUNT = 8

/**
 * 按终端宽度推导网格列数: 单元格等分 Card 内容区宽度,
 * 取每格仍不小于 MIN_CELL_WIDTH 的最大列数.
 */
export function gridColumnCount(columns: number, columnGap: number): number {
  const contentWidth = columns - TABLE_CHROME
  const count = Math.floor((contentWidth + columnGap) / (MIN_CELL_WIDTH + columnGap))
  return Math.min(Math.max(count, MIN_COLUMN_COUNT), MAX_COLUMN_COUNT)
}
