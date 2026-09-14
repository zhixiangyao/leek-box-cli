import { Box } from 'ink'
import { useMemo } from 'react'

import Text from '../Text.tsx'
import { buildChartRows, mergeChartCell, type BuildChartRowsParams } from './lib.ts'

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
  const rows = useMemo(
    () =>
      buildChartRows({
        points,
        period,
        prevClose,
        width,
        priceHeight,
        volumeHeight,
        trendColorMode,
      }).map((row) => mergeChartCell(row)),
    [points, period, prevClose, width, priceHeight, volumeHeight, trendColorMode],
  )

  return (
    <Box flexDirection="column">
      {rows.map((row, rowIndex) => (
        <Text key={rowIndex} bright={bright}>
          {row.map((cell, cellIndex) => (
            <Text key={cellIndex} bright={bright} color={cell.color}>
              {cell.ch}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  )
}
