import { Box, Text } from 'ink'

import type { IntradayPoint } from '../../api/types.ts'
import { buildChartRows, type ChartCell } from './lib.ts'

type IntradayChartProps = {
  points: IntradayPoint[]
  prevClose: number | null
  /** 可用列数 */
  width: number
  /** 价格区高度 (行) */
  priceHeight?: number
  /** 成交量柱区高度 (行) */
  volumeHeight?: number
}

/** 今日分时图: 价格折线 + 昨收虚线 + 成交量柱 + 时间轴 */
export default function IntradayChart({
  points,
  prevClose,
  width,
  priceHeight = 9,
  volumeHeight = 4,
}: IntradayChartProps) {
  const rows = buildChartRows(points, prevClose, width, priceHeight, volumeHeight)

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
          <Text key={rowIndex}>
            {runs.map((run, runIndex) => (
              <Text key={runIndex} color={run.color}>
                {run.text}
              </Text>
            ))}
          </Text>
        )
      })}
    </Box>
  )
}
