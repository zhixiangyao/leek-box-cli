import stringWidth from 'string-width'

import type { Quote } from '../api/types.ts'
import {
  DEFAULT_TREND_COLOR_MODE,
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatRatio,
  formatRate,
  formatSigned,
  formatTurnover,
  formatVolume,
  trendColor,
  type TrendColor,
  type TrendColorMode,
} from './format.ts'

type ColumnKind = 'code' | 'name' | 'changePercent' | 'value'

export type Column = {
  key: keyof Quote
  kind: ColumnKind
  title: string
  width: number
  render: (quote: Quote) => string
  color?: (quote: Quote, trendColorMode: TrendColorMode) => TrendColor
  suspendedText?: string
}

export type Row = { text: string; color?: TrendColor }[]

const cell = (text: string, column: Column) => text + ' '.repeat(Math.max(0, column.width - stringWidth(text)))

const withSeparators = (segments: Row): Row =>
  segments.map((segment, index) => ({
    ...segment,
    text: index < segments.length - 1 ? `${segment.text} ` : segment.text,
  }))

export const COLUMNS: readonly Column[] = [
  {
    key: 'code',
    kind: 'code',
    title: '代码',
    width: 9,
    render: (q: Quote) => q.code,
  },
  {
    key: 'name',
    kind: 'name',
    title: '名称',
    width: 9,
    render: (q: Quote) => q.name,
  },
  {
    key: 'current',
    kind: 'value',
    title: '现价',
    width: 8,
    render: (q) => formatPrice(q.current),
    color: (q, mode) => trendColor(q.change, mode),
  },
  {
    key: 'changePercent',
    kind: 'changePercent',
    title: '涨跌幅',
    width: 9,
    render: (q) => formatPercent(q.changePercent),
    color: (q, mode) => trendColor(q.changePercent, mode),
    suspendedText: '停牌',
  },
  {
    key: 'change',
    kind: 'value',
    title: '涨跌额',
    width: 8,
    render: (q) => formatSigned(q.change),
    color: (q, mode) => trendColor(q.change, mode),
  },
  {
    key: 'open',
    kind: 'value',
    title: '今开',
    width: 7,
    render: (q) => formatPrice(q.open),
  },
  {
    key: 'prevClose',
    kind: 'value',
    title: '昨收',
    width: 7,
    render: (q) => formatPrice(q.prevClose),
  },
  {
    key: 'high',
    kind: 'value',
    title: '最高',
    width: 7,
    render: (q) => formatPrice(q.high),
  },
  {
    key: 'low',
    kind: 'value',
    title: '最低',
    width: 7,
    render: (q) => formatPrice(q.low),
  },
  {
    key: 'volume',
    kind: 'value',
    title: '成交量',
    width: 11,
    render: (q) => formatVolume(q.volume),
  },
  {
    key: 'turnover',
    kind: 'value',
    title: '成交额',
    width: 9,
    render: (q) => formatTurnover(q.turnover),
  },
  {
    key: 'turnoverRate',
    kind: 'value',
    title: '换手率',
    width: 7,
    render: (q) => formatRate(q.turnoverRate),
  },
  {
    key: 'amplitude',
    kind: 'value',
    title: '振幅',
    width: 7,
    render: (q) => formatRate(q.amplitude),
  },
  {
    key: 'volumeRatio',
    kind: 'value',
    title: '量比',
    width: 7,
    render: (q) => formatRatio(q.volumeRatio),
  },
  {
    key: 'marketCap',
    kind: 'value',
    title: '总市值',
    width: 10,
    render: (q) => formatMarketCap(q.marketCap),
  },
]

export const COLUMNS_BY_KEY = new Map(COLUMNS.map((column) => [column.key, column]))

const pickColumns = (keys: readonly (keyof Quote)[]): Column[] =>
  keys.map((key) => {
    const column = COLUMNS_BY_KEY.get(key)
    if (column === undefined) throw new Error(`未知行情列: ${key}`)
    return column
  })

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

export const STOCK_LIST_COLUMNS = pickColumns(STOCK_LIST_KEYS)

export const STOCK_DETAIL_COLUMNS = pickColumns(STOCK_DETAIL_KEYS)

/** 表格总宽 = 各列宽之和 + 列间分隔 */
export const tableWidth = (columns: readonly Column[]): number =>
  columns.reduce((sum, column) => sum + column.width, 0) + (columns.length - 1)

/** 表头行 */
export const headerRow = (columns: readonly Column[]): Row =>
  withSeparators(columns.map((col) => ({ text: cell(col.title, col), color: 'gray' })))

/** 股票数据行 */
export const quoteRow = (
  columns: readonly Column[],
  quote: Quote,
  trendColorMode: TrendColorMode = DEFAULT_TREND_COLOR_MODE,
): Row => {
  const suspended = quote.current <= 0
  return withSeparators(
    columns.map((col) => ({
      text: cell(suspended ? (col.suspendedText ?? '--') : col.render(quote), col),
      color: suspended || !col.color ? 'gray' : col.color(quote, trendColorMode),
    })),
  )
}

/** 缺失行 */
export const missingRow = (columns: readonly Column[], code: string, name: string): Row =>
  withSeparators(
    columns.map((col) => ({
      text: cell(
        col.kind === 'code' ? code : col.kind === 'name' ? name : col.kind === 'changePercent' ? '无数据' : '--',
        col,
      ),
      color: 'gray',
    })),
  )
