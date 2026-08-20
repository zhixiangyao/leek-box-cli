import type { Quote } from '../../api/types.ts'
import { COLUMNS } from '../../lib/columns.ts'

/** 看板 12 列: 显式 key 挑选 (昨收/振幅/量比仅详情面板用, 不占看板列宽) */
const STOCK_LIST_KEYS: readonly (keyof Quote)[] = [
  'code',
  'name',
  'current',
  'changePercent',
  'change',
  'open',
  'high',
  'low',
  'volume',
  'turnover',
  'turnoverRate',
  'marketCap',
]
export const STOCK_LIST_COLUMNS = COLUMNS.filter((col) => STOCK_LIST_KEYS.includes(col.key))

/** 表格总宽 (内容列宽和 + 列间分隔空格); WindowSizeGuard 的 MIN_COLUMNS 由此推导, 不要硬编码 */
export const tableWidth = () =>
  STOCK_LIST_COLUMNS.reduce((sum, col) => sum + col.width, 0) + (STOCK_LIST_COLUMNS.length - 1)

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

/** 滚动窗口切片: quotes 与 missing 两侧的 slice 下标 (拼接序列上 quotes 在前, missing 在后) */
export type TableSliceRange = {
  quoteStart: number
  quoteEnd: number
  missingStart: number
  missingEnd: number
}

/** 在 quotes + missing 拼接序列上切窗并拆回两侧切片 */
export const tableSlices = (
  visible: number,
  quotesLength: number,
  missingLength: number,
  scrollOffset: number,
): TableSliceRange => {
  const { start, end } = visibleWindow(quotesLength + missingLength, scrollOffset, visible)
  return {
    quoteStart: Math.min(start, quotesLength),
    quoteEnd: Math.min(end, quotesLength),
    missingStart: Math.max(0, start - quotesLength),
    missingEnd: Math.max(0, end - quotesLength),
  }
}
