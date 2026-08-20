import type { Quote } from '../api/types.ts'
import { COLUMNS } from './columns.ts'

/** 看板 12 列: 显式 key 挑选 (昨收/振幅/量比仅详情面板用, 不占看板列宽). */
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

export const STOCK_LIST_COLUMNS = COLUMNS.filter((column) => STOCK_LIST_KEYS.includes(column.key))

/** 表格总宽: 内容列宽和 + 列间分隔空格. */
export const stockTableWidth = () =>
  STOCK_LIST_COLUMNS.reduce((sum, column) => sum + column.width, 0) + (STOCK_LIST_COLUMNS.length - 1)
