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

export const TREND_COLOR_MODE_LABELS: Record<TrendColorMode, string> = {
  'red-up': '涨红跌绿',
  'green-up': '涨绿跌红',
}

export const DEFAULT_TREND_COLOR_MODE: TrendColorMode = 'red-up'

export type TrendColor = 'red' | 'green' | 'gray'

/** 涨跌色 (默认涨红跌绿, 可切换为涨绿跌红) -> 'red' / 'green' / 'gray' */
export const trendColor = (value: number, mode: TrendColorMode = DEFAULT_TREND_COLOR_MODE): TrendColor => {
  if (value === 0) return 'gray'
  const rising = isPositive(value)
  const greenOnRise = mode === 'green-up'
  return rising === greenOnRise ? 'green' : 'red'
}

/** 成交量 (手) -> '61.1万手' / '1234手'; 非正值 '--' */
export const formatVolume = (value: number) =>
  value >= 10_000 ? `${(value / 10_000).toFixed(1)}万手` : isPositive(value) ? `${Math.round(value)}手` : EMPTY_VALUE

/** 成交额 (万元) -> '5.50亿' / '880.0万'; 非正值 '--' */
export const formatTurnover = (value: number) =>
  value >= 10_000 ? `${(value / 10_000).toFixed(2)}亿` : isPositive(value) ? `${value.toFixed(1)}万` : EMPTY_VALUE

/** 比率 (%, 换手率/振幅) -> '1.33%' (不带符号); 非正值 '--' */
export const formatRate = (value: number) => (isPositive(value) ? `${value.toFixed(2)}%` : EMPTY_VALUE)

/** 量比 -> '1.21'; 非正值 '--' */
export const formatRatio = (value: number) => (isPositive(value) ? value.toFixed(2) : EMPTY_VALUE)

/** 总市值 (亿) -> '2987.53亿'; 非正值 '--' */
export const formatMarketCap = (value: number) => (isPositive(value) ? `${value.toFixed(2)}亿` : EMPTY_VALUE)

/** 行情时间戳 (yyyyMMddHHmmss) -> 'HH:MM:SS' */
export const formatClock = (timestamp: string) =>
  `${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}`
