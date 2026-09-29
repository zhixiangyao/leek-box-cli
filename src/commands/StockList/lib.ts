import type { StockListRow, StockListStep } from '../../stores/useStockListStore.ts'

/**
 * 滚动窗口 [start, end): 窗口起点由 scrollOffset 决定 (越界钳制), 不与选中行绑定.
 * 否则窗口保持原位 (从末尾往上选时视图不变, 选中行先走完整个窗口).
 */
export const visibleWindow = (total: number, scrollOffset: number, visible: number): { start: number; end: number } => {
  if (total <= visible) return { start: 0, end: total }
  const maxStart = total - visible
  const start = Math.min(Math.max(scrollOffset, 0), maxStart)
  return { start, end: start + visible }
}

/** default 保持自选股文件顺序, desc/asc 按涨跌幅从高到低, 从低到高 */
export type StockListSortMode = 'default' | 'desc' | 'asc'

/** 快捷键循环: 文件顺序 -> 降序 -> 升序 -> 文件顺序 */
export const SORT_MODE_CYCLE: Record<StockListSortMode, StockListSortMode> = {
  default: 'desc',
  desc: 'asc',
  asc: 'default',
}

/**
 * 按涨跌幅排序, default 原样返回 (即自选股文件顺序).
 * 缺失行没有涨跌幅可比排在末尾, 同涨跌幅的行由 sort 的稳定性保持文件顺序.
 */
export const sortedRows = (rows: StockListRow[], sortMode: StockListSortMode): StockListRow[] => {
  if (sortMode === 'default') return rows
  const quotes = rows.filter((row): row is Extract<StockListRow, { kind: 'quote' }> => row.kind === 'quote')
  const missing = rows.filter((row) => row.kind === 'missing')
  const direction = sortMode === 'desc' ? -1 : 1
  quotes.sort((left, right) => direction * (left.quote.changePercent - right.quote.changePercent))
  return [...quotes, ...missing]
}

/** 从 step 取显示顺序的行 (非 table 时为空): 看板渲染, 方向键和视口锚定都按它算 */
export const displayedRows = (step: StockListStep, sortMode: StockListSortMode): StockListRow[] =>
  step.type === 'table' ? sortedRows(step.rows, sortMode) : []

export const clampSelection = (index: number, rowCount: number) => Math.min(Math.max(index, 0), rowCount - 1)

/** 行在显示顺序里的下标: 没有选中行或该行已不在列表里时取首行 */
export const rowIndex = (rows: StockListRow[], code: string | undefined) => {
  if (!code) return 0
  const index = rows.findIndex((row) => row.code === code)
  return index < 0 ? 0 : index
}

/** 方向键移动后的滚动偏移: 选中行移出窗口时把窗口带过去, 否则保持原位 */
export const anchoredScrollOffset = (
  delta: 1 | -1,
  selectedIndex: number,
  rowCount: number,
  scrollOffset: number,
  visible: number,
) => {
  const next = clampSelection(selectedIndex + delta, rowCount)
  const maxOffset = Math.max(0, rowCount - visible)
  if (delta === 1 && next >= scrollOffset + visible) return Math.min(next - visible + 1, maxOffset)
  if (delta === -1 && next < scrollOffset) return next
  return Math.min(scrollOffset, maxOffset)
}

/** 显示顺序变了 (排序或刷新) 后, 用新旧下标让选中行停在窗口里的同一行 */
export const scrollOffsetAfterReorder = (previousIndex: number, nextIndex: number, scrollOffset: number) =>
  Math.max(0, nextIndex - Math.max(0, previousIndex - scrollOffset))
