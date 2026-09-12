import { DEFAULT_LOCALE } from '../i18n/locale.ts'
import type { Locale } from '../i18n/types.ts'
import { isPositive } from './is.ts'

export const EMPTY_VALUE = '--'

/** 价格 -> '12.34'; 非正值 '--' */
export const formatPrice = (value: number) => (isPositive(value) ? value.toFixed(2) : EMPTY_VALUE)

/** 涨跌额 (带符号) -> '+1.23' / '-0.45' */
export const formatSigned = (value: number) => `${isPositive(value) ? '+' : ''}${value.toFixed(2)}`

/** 涨跌幅 (带符号, %) -> '+1.23%' / '-0.45%' */
export const formatPercent = (value: number) => `${isPositive(value) ? '+' : ''}${value.toFixed(2)}%`

export const TREND_COLOR_MODES = ['red-up', 'green-up'] as const

export type TrendColorMode = (typeof TREND_COLOR_MODES)[number]

export const DEFAULT_TREND_COLOR_MODE: TrendColorMode = 'red-up'

export type TrendColor = 'red' | 'green' | 'gray'

/** 涨跌色 (默认涨红跌绿, 可切换为涨绿跌红) -> 'red' / 'green' / 'gray' */
export const trendColor = (value: number, mode: TrendColorMode = DEFAULT_TREND_COLOR_MODE): TrendColor => {
  if (value === 0) return 'gray'
  const rising = isPositive(value)
  const greenOnRise = mode === 'green-up'
  return rising === greenOnRise ? 'green' : 'red'
}

/**
 * 数值单位档位: 达到 min 时把数值乘以 scale 后保留 decimals 位小数, 再拼上 suffix.
 * 单位是数据而不是文案, 因此按 locale 定义在这里, 不放进 i18n catalog.
 * 亿/万/手 与 B/M/K/lots 之间是换算关系, 所以用 scale 而不是单纯改后缀.
 * min 必须与 scale 对应 (即 min * scale 落在 1 附近), 否则该档在自己的下界就渲染成两位数,
 * 相当于跳过了一个数量级.
 */
type Unit = {
  min: number
  scale: number
  decimals: number
  suffix: string
}

/** 成交量 (手) 单位, 按 min 从大到小排列 */
const VOLUME_UNITS: Record<Locale, readonly Unit[]> = {
  'zh-hans': [
    { min: 10_000, scale: 1 / 10_000, decimals: 1, suffix: '万手' },
    { min: 0, scale: 1, decimals: 0, suffix: '手' },
  ],
  'zh-hant': [
    { min: 10_000, scale: 1 / 10_000, decimals: 1, suffix: '萬張' },
    { min: 0, scale: 1, decimals: 0, suffix: '張' },
  ],
  en: [
    { min: 1_000_000, scale: 1 / 1_000_000, decimals: 1, suffix: 'M lots' },
    { min: 1_000, scale: 1 / 1000, decimals: 1, suffix: 'K lots' },
    { min: 0, scale: 1, decimals: 0, suffix: ' lots' },
  ],
}

/** 成交额 (万元) 单位, 按 min 从大到小排列 */
const TURNOVER_UNITS: Record<Locale, readonly Unit[]> = {
  'zh-hans': [
    { min: 10_000, scale: 1 / 10_000, decimals: 2, suffix: '亿' },
    { min: 0, scale: 1, decimals: 1, suffix: '万' },
  ],
  'zh-hant': [
    { min: 10_000, scale: 1 / 10_000, decimals: 2, suffix: '億' },
    { min: 0, scale: 1, decimals: 1, suffix: '萬' },
  ],
  en: [
    { min: 100, scale: 1 / 100, decimals: 1, suffix: 'M' },
    { min: 0, scale: 10, decimals: 1, suffix: 'K' },
  ],
}

/** 总市值 (亿) 单位, 按 min 从大到小排列 */
const MARKET_CAP_UNITS: Record<Locale, readonly Unit[]> = {
  'zh-hans': [{ min: 0, scale: 1, decimals: 2, suffix: '亿' }],
  'zh-hant': [{ min: 0, scale: 1, decimals: 2, suffix: '億' }],
  en: [
    { min: 10, scale: 1 / 10, decimals: 2, suffix: 'B' },
    { min: 0, scale: 100, decimals: 1, suffix: 'M' },
  ],
}

/** 按单个档位渲染数值部分 */
const renderValue = (value: number, unit: Unit): string => (value * unit.scale).toFixed(unit.decimals)

/**
 * 按 locale 的单位表格式化, 非正值返回占位符.
 * 档位边界上四舍五入会进位: 999950 手若用 K 档会渲染成 '1000.0K lots',
 * 因此渲染值达到上一档起点时改用上一档, 输出 '1.0M lots'.
 * 起点按本档小数位取整后再比较, 避免 scale 的浮点误差把边界推高一格.
 */
const formatWithUnits = (value: number, units: readonly Unit[]): string => {
  if (!isPositive(value)) return EMPTY_VALUE
  let index = units.findIndex((candidate) => value >= candidate.min)
  if (index === -1) return EMPTY_VALUE

  while (index > 0) {
    const unit = units[index]!
    const upper = units[index - 1]!
    if (Number(renderValue(value, unit)) < Number((upper.min * unit.scale).toFixed(unit.decimals))) break
    index -= 1
  }

  const unit = units[index]!
  return `${renderValue(value, unit)}${unit.suffix}`
}

/** 成交量 (手) -> '61.1万手' / '611.0K lots'; 非正值 '--' */
export const formatVolume = (value: number, locale: Locale = DEFAULT_LOCALE) =>
  formatWithUnits(value, VOLUME_UNITS[locale])

/** 成交额 (万元) -> '5.50亿' / '550.0M'; 非正值 '--' */
export const formatTurnover = (value: number, locale: Locale = DEFAULT_LOCALE) =>
  formatWithUnits(value, TURNOVER_UNITS[locale])

/** 比率 (%, 换手率/振幅) -> '1.33%' (不带符号); 非正值 '--' */
export const formatRate = (value: number) => (isPositive(value) ? `${value.toFixed(2)}%` : EMPTY_VALUE)

/** 量比 -> '1.21'; 非正值 '--' */
export const formatRatio = (value: number) => (isPositive(value) ? value.toFixed(2) : EMPTY_VALUE)

/** 总市值 (亿) -> '2987.53亿' / '298.75B'; 非正值 '--' */
export const formatMarketCap = (value: number, locale: Locale = DEFAULT_LOCALE) =>
  formatWithUnits(value, MARKET_CAP_UNITS[locale])

/** 行情时间戳 (yyyyMMddHHmmss) -> 'HH:MM:SS' */
export const formatClock = (timestamp: string) =>
  `${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}`
