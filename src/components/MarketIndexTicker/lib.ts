import stringWidth from 'string-width'

import type { Quote } from '../../api/types.ts'
import { formatPercent, formatPrice, formatSigned, trendColor, type TrendColorMode } from '../../lib/format.ts'
import type { Row } from '../../lib/quoteTable.ts'

/** 每 5 秒换一个指数, 换的时候用 1 秒打字机过渡 */
export const INDEX_SWITCH_MS = 5000

export const INDEX_TRANSITION_MS = 1000

export const INDEX_FRAME_MS = 50

/** 指数行: 名称用默认色, 数值段按涨跌幅取涨跌色 */
export const indexSegments = (quote: Quote, trendColorMode: TrendColorMode): Row => [
  { text: `${quote.name} ` },
  {
    text: `${formatPrice(quote.current)} ${formatSigned(quote.change)} ${formatPercent(quote.changePercent)}`,
    color: trendColor(quote.changePercent, trendColorMode),
  },
]

/**
 * 打字机: progress (0..1) 决定写出整行的前多少列, 其余补空格到整行宽度.
 * 补空格是必须的: 这一行摆在居中槽位里, 行宽随进度变化的话文字会左右抖.
 */
export const typewriterSegments = (segments: Row, progress: number): Row => {
  const totalWidth = segments.reduce((sum, segment) => sum + stringWidth(segment.text), 0)
  const columns = Math.round(Math.min(Math.max(progress, 0), 1) * totalWidth)
  const revealed: Row = []
  let revealedWidth = 0

  for (const segment of segments) {
    if (revealedWidth >= columns) break
    let text = ''
    for (const character of segment.text) {
      const width = stringWidth(character)
      // 按显示宽度逐字累加: 放不下的那个字 (CJK 常是半个) 整个留给下一帧
      if (revealedWidth + width > columns) break
      text += character
      revealedWidth += width
    }
    if (text !== '') revealed.push({ ...segment, text })
  }

  const padding = totalWidth - revealedWidth
  return padding > 0 ? [...revealed, { text: ' '.repeat(padding) }] : revealed
}
