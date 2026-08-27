import type { Quote } from '../api/types.ts'
import { type Column, COLUMNS_BY_KEY } from './columns.ts'

/** 列表 12 列: 显式 key 挑选 (昨收/振幅/量比仅详情面板用, 不占看板列宽) */
const STOCK_LIST_KEYS: readonly (keyof Quote)[] = [
  'name',
  'code',
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

/** 详情 10 列: 显式 key 挑选 (现价/涨跌额已在弹窗标题行展示, 不重复) */
const STOCK_DETAIL_KEYS: readonly (keyof Quote)[] = [
  'open',
  'prevClose',
  'high',
  'low',
  'volume',
  'turnover',
  'turnoverRate',
  'amplitude',
  'volumeRatio',
  'marketCap',
]

export const STOCK_LIST_COLUMNS = STOCK_LIST_KEYS.reduce<Column[]>((acc, key) => {
  const column = COLUMNS_BY_KEY.get(key)
  if (column) acc.push(column)
  return acc
}, [])

export const STOCK_DETAIL_COLUMNS = STOCK_DETAIL_KEYS.reduce<Column[]>((acc, key) => {
  const column = COLUMNS_BY_KEY.get(key)
  if (column) acc.push(column)
  return acc
}, [])

/** 列表表格总宽 */
export const stockListColumnsWidth = () =>
  STOCK_LIST_COLUMNS.reduce((sum, column) => sum + column.width, 0) + (STOCK_LIST_COLUMNS.length - 1)

/** 详情表格总宽 */
export const stockDetailColumnsWidth = () =>
  STOCK_DETAIL_COLUMNS.reduce((sum, col) => sum + col.width, 0) + (STOCK_DETAIL_COLUMNS.length - 1)
