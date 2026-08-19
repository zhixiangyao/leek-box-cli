import type { Quote } from '../../api/types.ts'
import { COLUMNS } from '../../lib/columns.ts'
import { DIALOG_CHROME } from '../Dialog.tsx'

/** 详情面板 10 列: 显式 key 挑选 (现价/涨跌额已在弹窗标题行展示, 不重复) */
const DETAIL_KEYS: readonly (keyof Quote)[] = [
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
export const DETAIL_COLUMNS = COLUMNS.filter((col) => DETAIL_KEYS.includes(col.key))

/** 详情表格内容宽 (列宽和 79 + 9 个列间分隔), 由表推导不要硬编码 */
export const detailWidth = () => DETAIL_COLUMNS.reduce((sum, col) => sum + col.width, 0) + (DETAIL_COLUMNS.length - 1)

/** 弹窗宽度 = 内容宽 + DIALOG_CHROME (92), 恰容一行 10 项 */
export const STOCK_DETAIL_WIDTH = detailWidth() + DIALOG_CHROME
export const CONTENT_WIDTH = STOCK_DETAIL_WIDTH - DIALOG_CHROME
