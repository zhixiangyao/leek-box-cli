import { Box } from 'ink'

import type { ChartPeriod, ChartPoint } from '../../api/types.ts'
import type { TrendColorMode } from '../../lib/format.ts'
import Text from '../Text.tsx'
import { buildChartRows, type ChartCell } from './lib.ts'

const DEFAULT_PRICE_HEIGHT = 9
const DEFAULT_VOLUME_HEIGHT = 4
export const STOCK_CHART_HEIGHT = DEFAULT_PRICE_HEIGHT + DEFAULT_VOLUME_HEIGHT + 1

type Props = {
  points: ChartPoint[]
  period: ChartPeriod
  prevClose?: number
  /** 可用列数 */
  width: number
  /** 价格区高度 (行) */
  priceHeight?: number
  /** 成交量柱区高度 (行) */
  volumeHeight?: number
  bright?: boolean
  trendColorMode?: TrendColorMode
}

/** 股票趋势图: 分时/五日/K 线收盘趋势 + 分时参考价虚线 + 成交量柱 + 时间轴 */
export default function StockChart({
  points,
  period,
  prevClose,
  width,
  priceHeight = DEFAULT_PRICE_HEIGHT,
  volumeHeight = DEFAULT_VOLUME_HEIGHT,
  bright = false,
  trendColorMode,
}: Props) {
  const rows = buildChartRows({ points, period, prevClose, width, priceHeight, volumeHeight, trendColorMode })

  return (
    <Box flexDirection="column">
      {rows.map((row, rowIndex) => {
        // 相邻同色 cell 合并成 run, 减少 Text 片段数量
        const runs: { text: string; color?: ChartCell['color'] }[] = []
        for (const cell of row) {
          const last = runs.at(-1)
          if (last && last.color === cell.color) {
            last.text += cell.ch
          } else {
            runs.push({ text: cell.ch, color: cell.color })
          }
        }
        return (
          <Text key={rowIndex} bright={bright}>
            {runs.map((run, runIndex) => (
              <Text key={runIndex} bright={bright} color={run.color}>
                {run.text}
              </Text>
            ))}
          </Text>
        )
      })}
    </Box>
  )
}
