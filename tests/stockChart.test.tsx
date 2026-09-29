import { Box, Text } from 'ink'
import { expect, test } from 'vitest'

import type { IntradayPoint } from '../src/api/types.ts'
import StockChart, { STOCK_CHART_HEIGHT } from '../src/components/StockChart/index.tsx'
import { CaptureOutput, plain, renderInk, waitForFrame } from './helpers/ink.tsx'

const CHART_WIDTH = 40

/** 模块级构造, 保证重渲染时 points 引用不变 (useMemo 命中) */
const CHART_POINTS: IntradayPoint[] = Array.from({ length: 60 }, (_unused, index) => ({
  time: `${(9 + Math.floor((30 + index * 4) / 60)).toString().padStart(2, '0')}${((30 + index * 4) % 60).toString().padStart(2, '0')}`,
  price: 66 + Math.sin(index / 5),
  volume: (index + 1) * 1000,
}))

const ChartHarness = ({ tick }: { tick: number }) => (
  <Box width={CHART_WIDTH} flexDirection="column">
    <Text>tick={tick}</Text>
    <StockChart points={CHART_POINTS} period="intraday" prevClose={66} width={CHART_WIDTH} />
  </Box>
)

/**
 * 缓存 buildChartRows 之后暴露的回归: run 合并曾就地改写被缓存的 cell, 于是入参一个都没变
 * (memo 命中) 的重渲染也会把同一段文本再拼一遍, 行宽越滚越大, 图表折行溢出固定高度的 Box,
 * 弹窗整个糊掉. 这里连续重渲染并断言行数/行宽不变.
 */
test('StockChart 入参未变时重渲染, 图表行数与行宽保持不变', async () => {
  const output = new CaptureOutput(CHART_WIDTH + 20, 20)
  const instance = renderInk(<ChartHarness tick={0} />, { output, interactive: false })

  try {
    let after = 0
    for (let tick = 0; tick <= 4; tick++) {
      if (tick > 0) {
        after = output.frames.length
        instance.rerender(<ChartHarness tick={tick} />)
      }

      const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(`tick=${tick}`))
      const lines = plain(frame).split('\n')
      const label = `tick=${tick}`

      expect(lines, label).toHaveLength(STOCK_CHART_HEIGHT + 1)
      expect(
        lines.slice(1).every((line) => line.length === CHART_WIDTH),
        label,
      ).toBe(true)
    }
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})
