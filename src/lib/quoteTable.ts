import stringWidth from 'string-width'

import type { Quote } from '../api/types.ts'
import { createTranslator } from '../i18n/core.ts'
import { DEFAULT_LOCALE } from '../i18n/locale.ts'
import type { MessageKey, Locale } from '../i18n/types.ts'
import {
  DEFAULT_TREND_COLOR_MODE,
  EMPTY_VALUE,
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

/** 表头与占位文案的键, 宽度按 locale 分开, 因为英文表头比中文表头宽 */
type ColumnSpec = {
  key: keyof Quote
  kind: ColumnKind
  title: MessageKey
  widths: Record<Locale, number>
  render: (quote: Quote, locale: Locale) => string
  color?: (quote: Quote, trendColorMode: TrendColorMode) => TrendColor
  suspendedText?: MessageKey
  missingText?: MessageKey
}

export type Column = {
  key: keyof Quote
  kind: ColumnKind
  title: string
  width: number
  render: (quote: Quote) => string
  color?: (quote: Quote, trendColorMode: TrendColorMode) => TrendColor
  suspendedText?: string
  missingText?: string
}

export type Row = { text: string; color?: TrendColor }[]

const cell = (text: string, column: Column) => text + ' '.repeat(Math.max(0, column.width - stringWidth(text)))

const withSeparators = (segments: Row): Row =>
  segments.map((segment, index) => ({
    ...segment,
    text: index < segments.length - 1 ? `${segment.text} ` : segment.text,
  }))

/** 单一来源列定义: 文案用键, 宽度按 locale 分开 */
const COLUMN_SPECS: readonly ColumnSpec[] = [
  {
    key: 'code',
    kind: 'code',
    title: 'table.column.code',
    widths: { 'zh-hans': 9, 'zh-hant': 9, en: 9 },
    render: (q: Quote) => q.code,
  },
  {
    key: 'name',
    kind: 'name',
    title: 'table.column.name',
    widths: { 'zh-hans': 9, 'zh-hant': 9, en: 9 },
    render: (q: Quote) => q.name,
  },
  {
    key: 'current',
    kind: 'value',
    title: 'table.column.current',
    widths: { 'zh-hans': 8, 'zh-hant': 8, en: 8 },
    render: (q) => formatPrice(q.current),
    color: (q, mode) => trendColor(q.change, mode),
  },
  {
    key: 'changePercent',
    kind: 'changePercent',
    title: 'table.column.changePercent',
    widths: { 'zh-hans': 9, 'zh-hant': 9, en: 9 },
    render: (q) => formatPercent(q.changePercent),
    color: (q, mode) => trendColor(q.changePercent, mode),
    suspendedText: 'common.suspended',
    missingText: 'common.noData',
  },
  {
    key: 'change',
    kind: 'value',
    title: 'table.column.change',
    widths: { 'zh-hans': 8, 'zh-hant': 8, en: 8 },
    render: (q) => formatSigned(q.change),
    color: (q, mode) => trendColor(q.change, mode),
  },
  {
    key: 'open',
    kind: 'value',
    title: 'table.column.open',
    widths: { 'zh-hans': 7, 'zh-hant': 7, en: 7 },
    render: (q) => formatPrice(q.open),
  },
  {
    key: 'prevClose',
    kind: 'value',
    title: 'table.column.prevClose',
    widths: { 'zh-hans': 7, 'zh-hant': 7, en: 10 },
    render: (q) => formatPrice(q.prevClose),
  },
  {
    key: 'high',
    kind: 'value',
    title: 'table.column.high',
    widths: { 'zh-hans': 7, 'zh-hant': 7, en: 7 },
    render: (q) => formatPrice(q.high),
  },
  {
    key: 'low',
    kind: 'value',
    title: 'table.column.low',
    widths: { 'zh-hans': 7, 'zh-hant': 7, en: 7 },
    render: (q) => formatPrice(q.low),
  },
  {
    key: 'volume',
    kind: 'value',
    title: 'table.column.volume',
    widths: { 'zh-hans': 11, 'zh-hant': 11, en: 11 },
    render: (q, locale) => formatVolume(q.volume, locale),
  },
  {
    key: 'turnover',
    kind: 'value',
    title: 'table.column.turnover',
    widths: { 'zh-hans': 9, 'zh-hant': 9, en: 9 },
    render: (q, locale) => formatTurnover(q.turnover, locale),
  },
  {
    key: 'turnoverRate',
    kind: 'value',
    title: 'table.column.turnoverRate',
    widths: { 'zh-hans': 7, 'zh-hant': 7, en: 10 },
    render: (q) => formatRate(q.turnoverRate),
  },
  {
    key: 'amplitude',
    kind: 'value',
    title: 'table.column.amplitude',
    widths: { 'zh-hans': 7, 'zh-hant': 7, en: 9 },
    render: (q) => formatRate(q.amplitude),
  },
  {
    key: 'volumeRatio',
    kind: 'value',
    title: 'table.column.volumeRatio',
    widths: { 'zh-hans': 7, 'zh-hant': 7, en: 9 },
    render: (q) => formatRatio(q.volumeRatio),
  },
  {
    key: 'marketCap',
    kind: 'value',
    title: 'table.column.marketCap',
    widths: { 'zh-hans': 10, 'zh-hant': 10, en: 10 },
    render: (q, locale) => formatMarketCap(q.marketCap, locale),
  },
]

/**
 * 解析指定 locale 下的列: 文案绑定该 locale 翻译, 数值按该 locale 的单位格式化.
 * 必须用 createTranslator(locale) 而不是全局 t, 否则传参 locale 不会生效.
 */
const resolveColumns = (locale: Locale): Column[] => {
  const translate = createTranslator(locale)
  return COLUMN_SPECS.map((spec) => ({
    key: spec.key,
    kind: spec.kind,
    title: translate(spec.title),
    width: spec.widths[locale],
    render: (quote: Quote) => spec.render(quote, locale),
    color: spec.color,
    suspendedText: spec.suspendedText === undefined ? undefined : translate(spec.suspendedText),
    missingText: spec.missingText === undefined ? undefined : translate(spec.missingText),
  }))
}

const pickColumns = (locale: Locale, keys: readonly (keyof Quote)[]): Column[] => {
  const columns = resolveColumns(locale)
  const byKey = new Map(columns.map((column) => [column.key, column]))
  return keys.map((key) => {
    const column = byKey.get(key)
    if (column === undefined) throw new Error(createTranslator(locale)('table.unknownColumn', { key }))
    return column
  })
}

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

/**
 * 已解析的列按 locale 缓存: 看板每次 resize 和轮询渲染都会取列, 缓存后不再重复构建,
 * 同时让返回的数组保持稳定引用. 因此返回的列定义是共享的, 调用方不得就地修改
 * (scaleColumns 需要改宽度时会复制).
 */
const listColumnsCache = new Map<Locale, Column[]>()
const detailColumnsCache = new Map<Locale, Column[]>()

const cachedColumns = (cache: Map<Locale, Column[]>, locale: Locale, keys: readonly (keyof Quote)[]): Column[] => {
  const cached = cache.get(locale)
  if (cached !== undefined) return cached
  const columns = pickColumns(locale, keys)
  cache.set(locale, columns)
  return columns
}

/** 看板列, 表头与单位随 locale 变化 */
export const stockListColumns = (locale: Locale = DEFAULT_LOCALE): Column[] =>
  cachedColumns(listColumnsCache, locale, STOCK_LIST_KEYS)

/** 详情列, 表头与单位随 locale 变化 */
export const stockDetailColumns = (locale: Locale = DEFAULT_LOCALE): Column[] =>
  cachedColumns(detailColumnsCache, locale, STOCK_DETAIL_KEYS)

/** 表格总宽 = 各列宽之和 + 列间分隔 */
export const tableWidth = (columns: readonly Column[]): number =>
  columns.reduce((sum, column) => sum + column.width, 0) + (columns.length - 1)

/**
 * 根据终端可用列宽等比例放大各列宽.
 * 每列先取比例值的整数下界, 再把剩余的列宽按小数部分从大到小逐列 +1 (最大余额法),
 * 保证最终列宽之和 === target, 恰好填满整行, 且没有哪一列会独吞残差.
 * 残差全部压给首列时它可能被压到内容宽度以下 (124 列下曾压到 6, 窄于 8 列宽的中文名),
 * 于是整行超宽, cell() 只补齐不截断, 末列会被折到下一行.
 * 需保证 target >= 列宽之和 (WindowSizeGuard 已保证), 此时每列只增不减, 列宽不小于内容宽度.
 */
export const scaleColumns = (columns: readonly Column[], targetContentWidth: number): Column[] => {
  const baseSum = columns.reduce((sum, column) => sum + column.width, 0)
  const ideals = columns.map((column) => (column.width / baseSum) * targetContentWidth)
  const widths = ideals.map((ideal) => Math.floor(ideal))
  const byFraction = ideals
    .map((ideal, index) => ({ index, fraction: ideal - Math.floor(ideal) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)

  let residual = targetContentWidth - widths.reduce((sum, width) => sum + width, 0)
  for (const { index } of byFraction) {
    if (residual <= 0) break
    widths[index] = widths[index]! + 1
    residual -= 1
  }

  return columns.map((column, index) => ({ ...column, width: widths[index]! }))
}

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
      text: cell(suspended ? (col.suspendedText ?? EMPTY_VALUE) : col.render(quote), col),
      color: suspended || !col.color ? 'gray' : col.color(quote, trendColorMode),
    })),
  )
}

/** 缺失行: 占位文案取自列元数据, 因此跟随列自己的 locale */
export const missingRow = (columns: readonly Column[], code: string, name: string): Row =>
  withSeparators(
    columns.map((col) => ({
      text: cell(col.kind === 'code' ? code : col.kind === 'name' ? name : (col.missingText ?? EMPTY_VALUE), col),
      color: 'gray',
    })),
  )
