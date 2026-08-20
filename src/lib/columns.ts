import type { Quote } from '../api/types.ts'
import {
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatRatio,
  formatRate,
  formatSigned,
  formatTurnover,
  formatVolume,
  trendColor,
} from './format.ts'

type Align = 'left' | 'right'
type TextColor = 'red' | 'green' | 'gray'
type ColumnKind = 'code' | 'name' | 'changePercent' | 'value'

/** 列定义: 渲染与颜色收进列内, 加列只需追加一项, 行渲染不会漏 */
type Column = {
  /** 渲染的 Quote 字段, 作为列的唯一标识 (挑选/引用用 key, 不用中文 title) */
  key: keyof Quote
  kind: ColumnKind
  title: string
  width: number
  align?: Align
  render: (quote: Quote) => string
  /** 涨跌色 (仅现价/涨跌幅/涨跌额); 缺省灰色 */
  color?: (quote: Quote) => TextColor
  /** 停牌时该列文案 */
  suspendedText?: string
}

/** CJK 字符按宽度 2 计算的显示宽度 (不引入 string-width 依赖) */
export const displayWidth = (value: string) =>
  [...value].reduce((width, ch) => width + (ch.codePointAt(0)! > 0x2e80 ? 2 : 1), 0)

export const cell = (text: string, column: Column) =>
  column.align === 'right'
    ? ' '.repeat(Math.max(0, column.width - displayWidth(text))) + text
    : text + ' '.repeat(Math.max(0, column.width - displayWidth(text)))

/** 表格片段: 文本 + 颜色, 由 StockList 渲染为嵌套 Text */
export type Row = { text: string; color?: TextColor }[]

/** 全量 15 列; 列宽需按实测最大内容校准, 窄了会折行把表头顶出屏幕 */
export const COLUMNS: readonly Column[] = [
  { key: 'code', kind: 'code', title: '代码', width: 9, render: (q: Quote) => q.code },
  { key: 'name', kind: 'name', title: '名称', width: 9, render: (q: Quote) => q.name },
  {
    key: 'current',
    kind: 'value',
    title: '现价',
    width: 8,
    align: 'right',
    render: (q) => formatPrice(q.current),
    color: (q) => trendColor(q.change),
  },
  {
    key: 'changePercent',
    kind: 'changePercent',
    title: '涨跌幅',
    width: 9,
    align: 'right',
    render: (q) => formatPercent(q.changePercent),
    color: (q) => trendColor(q.changePercent),
    suspendedText: '停牌',
  },
  {
    key: 'change',
    kind: 'value',
    title: '涨跌额',
    width: 8,
    align: 'right',
    render: (q) => formatSigned(q.change),
    color: (q) => trendColor(q.change),
  },
  { key: 'open', kind: 'value', title: '今开', width: 7, align: 'right', render: (q) => formatPrice(q.open) },
  {
    key: 'prevClose',
    kind: 'value',
    title: '昨收',
    width: 7,
    align: 'right',
    render: (q) => formatPrice(q.prevClose),
  },
  { key: 'high', kind: 'value', title: '最高', width: 7, align: 'right', render: (q) => formatPrice(q.high) },
  { key: 'low', kind: 'value', title: '最低', width: 7, align: 'right', render: (q) => formatPrice(q.low) },
  { key: 'volume', kind: 'value', title: '成交量', width: 11, align: 'right', render: (q) => formatVolume(q.volume) },
  {
    key: 'turnover',
    kind: 'value',
    title: '成交额',
    width: 9,
    align: 'right',
    render: (q) => formatTurnover(q.turnover),
  },
  {
    key: 'turnoverRate',
    kind: 'value',
    title: '换手率',
    width: 7,
    align: 'right',
    render: (q) => formatRate(q.turnoverRate),
  },
  {
    key: 'amplitude',
    kind: 'value',
    title: '振幅',
    width: 7,
    align: 'right',
    render: (q) => formatRate(q.amplitude),
  },
  {
    key: 'volumeRatio',
    kind: 'value',
    title: '量比',
    width: 7,
    align: 'right',
    render: (q) => formatRatio(q.volumeRatio),
  },
  {
    key: 'marketCap',
    kind: 'value',
    title: '总市值',
    width: 10,
    align: 'right',
    render: (q) => formatMarketCap(q.marketCap),
  },
]

/** 表头行 (全部灰色); 列间加 1 空格分隔, 避免右对齐列内容填满列宽时与前一列粘连 */
export const headerRow = (columns: readonly Column[]): Row =>
  withSeparators(columns.map((col) => ({ text: cell(col.title, col), color: 'gray' })))

/** 股票数据行; 停牌时数值列 '--', 涨跌幅列显示 '停牌' */
export const quoteRow = (columns: readonly Column[], quote: Quote): Row => {
  const suspended = quote.current <= 0
  return withSeparators(
    columns.map((col) => ({
      text: cell(suspended ? (col.suspendedText ?? '--') : col.render(quote), col),
      color: suspended || !col.color ? 'gray' : col.color(quote),
    })),
  )
}

/** 缺失行 (请求了但接口没返回): 代码/名称正常, 涨跌幅列 '无数据', 其余 '--' */
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

const withSeparators = (segments: Row): Row =>
  segments.map((segment, index) => ({
    ...segment,
    text: index < segments.length - 1 ? `${segment.text} ` : segment.text,
  }))
