import type { Quote } from '../../../api/types.ts'
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
} from '../../../lib/format.ts'

type Align = 'left' | 'right'
type TextColor = 'red' | 'green' | 'gray'
type ColumnKind = 'code' | 'name' | 'changePercent' | 'value'

/** 列定义: 渲染与颜色收进列内, 加列只需追加一项, 行渲染不会漏 */
type Column = {
  kind: ColumnKind
  title: string
  width: number
  align?: Align
  render: (quote: Quote) => string
  /** 涨跌色 (仅现价/涨跌幅/涨跌额); 缺省灰色 */
  color?: (quote: Quote) => TextColor
  /** 停牌时该列文案 (默认 '--') */
  suspendedText?: string
}

/** CJK 字符按宽度 2 计算的显示宽度 (不引入 string-width 依赖) */
export const displayWidth = (value: string) =>
  [...value].reduce((width, ch) => width + (ch.codePointAt(0)! > 0x2e80 ? 2 : 1), 0)

export const cell = (text: string, column: Column) =>
  column.align === 'right'
    ? ' '.repeat(Math.max(0, column.width - displayWidth(text))) + text
    : text + ' '.repeat(Math.max(0, column.width - displayWidth(text)))

/** 表格片段: 文本 + 颜色, 由 Dashboard 渲染为嵌套 Text */
export type Row = { text: string; color?: TextColor }[]

/** 15 列, 总宽由 tableWidth() 推导; 列宽需按实测最大内容校准, 窄了会折行把表头顶出屏幕 */
export const COLUMNS: readonly Column[] = [
  { kind: 'code', title: '代码', width: 10, render: (q: Quote) => q.code },
  { kind: 'name', title: '名称', width: 10, render: (q: Quote) => q.name },
  {
    kind: 'value',
    title: '现价',
    width: 8,
    align: 'right',
    render: (q) => formatPrice(q.current),
    color: (q) => trendColor(q.change),
  },
  {
    kind: 'changePercent',
    title: '涨跌幅',
    width: 9,
    align: 'right',
    render: (q) => formatPercent(q.changePercent),
    color: (q) => trendColor(q.changePercent),
    suspendedText: '停牌',
  },
  {
    kind: 'value',
    title: '涨跌额',
    width: 8,
    align: 'right',
    render: (q) => formatSigned(q.change),
    color: (q) => trendColor(q.change),
  },
  { kind: 'value', title: '今开', width: 7, align: 'right', render: (q) => formatPrice(q.open) },
  { kind: 'value', title: '昨收', width: 7, align: 'right', render: (q) => formatPrice(q.prevClose) },
  { kind: 'value', title: '最高', width: 7, align: 'right', render: (q) => formatPrice(q.high) },
  { kind: 'value', title: '最低', width: 7, align: 'right', render: (q) => formatPrice(q.low) },
  { kind: 'value', title: '成交量', width: 11, align: 'right', render: (q) => formatVolume(q.volume) },
  { kind: 'value', title: '成交额', width: 9, align: 'right', render: (q) => formatTurnover(q.turnover) },
  { kind: 'value', title: '换手率', width: 7, align: 'right', render: (q) => formatRate(q.turnoverRate) },
  { kind: 'value', title: '振幅', width: 7, align: 'right', render: (q) => formatRate(q.amplitude) },
  { kind: 'value', title: '量比', width: 7, align: 'right', render: (q) => formatRatio(q.volumeRatio) },
  { kind: 'value', title: '总市值', width: 10, align: 'right', render: (q) => formatMarketCap(q.marketCap) },
]

/** 表头行 (全部灰色); 列间加 1 空格分隔, 避免右对齐列内容填满列宽时与前一列粘连 */
export const headerRow = (): Row =>
  withSeparators(COLUMNS.map((col) => ({ text: cell(col.title, col), color: 'gray' })))

/** 股票数据行; 停牌时数值列 '--', 涨跌幅列显示 '停牌' */
export const quoteRow = (quote: Quote): Row => {
  const suspended = quote.current <= 0
  return withSeparators(
    COLUMNS.map((col) => ({
      text: cell(suspended ? (col.suspendedText ?? '--') : col.render(quote), col),
      color: suspended || !col.color ? 'gray' : col.color(quote),
    })),
  )
}

/** 缺失行 (请求了但接口没返回): 代码/名称正常, 涨跌幅列 '无数据', 其余 '--' */
export const missingRow = (code: string, name: string): Row =>
  withSeparators(
    COLUMNS.map((col) => ({
      text: cell(
        col.kind === 'code' ? code : col.kind === 'name' ? name : col.kind === 'changePercent' ? '无数据' : '--',
        col,
      ),
      color: 'gray',
    })),
  )

/** 表格总宽 (内容列宽和 + 列间分隔空格); WindowSizeGuard 的 MIN_COLUMNS 由此推导, 不要硬编码 */
export const tableWidth = () => COLUMNS.reduce((sum, col) => sum + col.width, 0) + (COLUMNS.length - 1)

/** 除最后一列外, 每列文本后追加 1 个分隔空格 */
const withSeparators = (segments: Row): Row =>
  segments.map((segment, index) => ({
    ...segment,
    text: index < segments.length - 1 ? `${segment.text} ` : segment.text,
  }))

/**
 * 滚动窗口 [start, end): 窗口起点由 viewStart 决定 (越界钳制), 不与选中行绑定.
 * 否则窗口保持原位 (从末尾往上选时视图不变, 选中行先走完整个窗口).
 */
export const visibleWindow = (total: number, viewStart: number, visible: number): { start: number; end: number } => {
  if (total <= visible) return { start: 0, end: total }
  const maxStart = total - visible
  const start = Math.min(Math.max(viewStart, 0), maxStart)
  return { start, end: start + visible }
}

/** 滚动窗口切片: quotes 与 missing 两侧的 slice 下标 (拼接序列上 quotes 在前, missing 在后) */
export type TableSliceRange = {
  quoteStart: number
  quoteEnd: number
  missingStart: number
  missingEnd: number
}

/** 在 quotes + missing 拼接序列上切窗并拆回两侧切片. */
export const tableSlices = (
  visible: number,
  quotesLength: number,
  missingLength: number,
  viewStart: number,
): TableSliceRange => {
  const { start, end } = visibleWindow(quotesLength + missingLength, viewStart, visible)
  return {
    quoteStart: Math.min(start, quotesLength),
    quoteEnd: Math.min(end, quotesLength),
    missingStart: Math.max(0, start - quotesLength),
    missingEnd: Math.max(0, end - quotesLength),
  }
}
