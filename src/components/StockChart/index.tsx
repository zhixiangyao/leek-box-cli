import { Box } from 'ink'

import Text from '../Text.tsx'
import { buildChartRows, type BuildChartRowsParams, type ChartCell } from './lib.ts'

const DEFAULT_PRICE_HEIGHT = 9

const DEFAULT_VOLUME_HEIGHT = 4

export const STOCK_CHART_HEIGHT = DEFAULT_PRICE_HEIGHT + DEFAULT_VOLUME_HEIGHT + 1

type Props = {
  /** 默认为 false */
  bright?: boolean
  points: BuildChartRowsParams['points']
  period: BuildChartRowsParams['period']
  prevClose?: BuildChartRowsParams['prevClose']
  width: BuildChartRowsParams['width']
  priceHeight?: BuildChartRowsParams['priceHeight']
  volumeHeight?: BuildChartRowsParams['volumeHeight']
  trendColorMode?: BuildChartRowsParams['trendColorMode']
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
        const runs = row.reduce<ChartCell[]>((acc, cell) => {
          const last = acc.at(-1)
          if (last && last.color === cell.color) {
            last.ch += cell.ch
          } else {
            acc.push(cell)
          }
          return acc
        }, [])

        return (
          <Text key={rowIndex} bright={bright}>
            {runs.map((run, runIndex) => (
              <Text key={runIndex} bright={bright} color={run.color}>
                {run.ch}
              </Text>
            ))}
          </Text>
        )
      })}
    </Box>
  )
}
