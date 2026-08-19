/** 行情数字格式化 + A股涨跌色 (涨红跌绿平灰) */
export const formatPrice = (value: number) => (value > 0 ? value.toFixed(2) : '--')

/** 涨跌额 (带符号) -> '+1.23' / '-0.45' */
export const formatSigned = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`

/** 涨跌幅 (带符号, %) -> '+1.23%' / '-0.45%' */
export const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`

/** A股涨跌色: 正红 负绿 平灰 */
export const trendColor = (value: number) => (value > 0 ? 'red' : value < 0 ? 'green' : 'gray')

/** 成交量 (手) -> '61.1万手' / '1234手'; 非正值 '--' */
export const formatVolume = (value: number) =>
  value >= 10_000 ? `${(value / 10_000).toFixed(1)}万手` : value > 0 ? `${Math.round(value)}手` : '--'

/** 成交额 (万元) -> '5.50亿' / '880.0万'; 非正值 '--' */
export const formatTurnover = (value: number) =>
  value >= 10_000 ? `${(value / 10_000).toFixed(2)}亿` : value > 0 ? `${value.toFixed(1)}万` : '--'

/** 比率 (%, 换手率/振幅) -> '1.33%' (不带符号); 非正值 '--' */
export const formatRate = (value: number) => (value > 0 ? `${value.toFixed(2)}%` : '--')

/** 量比 -> '1.21'; 非正值 '--' */
export const formatRatio = (value: number) => (value > 0 ? value.toFixed(2) : '--')

/** 总市值 (亿) -> '2987.53亿'; 非正值 '--' */
export const formatMarketCap = (value: number) => (value > 0 ? `${value.toFixed(2)}亿` : '--')
