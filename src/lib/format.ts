/** 行情数字格式化 + A股涨跌色 (涨红跌绿平灰); 跨页面共享, 约定见 SKILL.md 界面风格 */
export const formatPrice = (value: number) => (value > 0 ? value.toFixed(2) : '--')

export const formatSigned = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`

export const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`

export const trendColor = (value: number) => (value > 0 ? 'red' : value < 0 ? 'green' : 'gray')
