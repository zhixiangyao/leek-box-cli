import { PassThrough, Writable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'

import { Box, Text, render } from 'ink'
import { expect, test } from 'vitest'

import type { IntradayPoint } from '../src/api/types.ts'
import StockChart, { STOCK_CHART_HEIGHT } from '../src/components/StockChart/index.tsx'
import { bucketize, buildChartRows, mergeChartCell } from '../src/components/StockChart/lib.ts'

process.env['FORCE_COLOR'] = '1'

test('bucketize 对非正宽度返回空数组', () => {
  expect(bucketize([], 0)).toStrictEqual([])
  expect(bucketize([], -1)).toStrictEqual([])
})

test('bucketize 生成与宽度一致的空桶', () => {
  const buckets = bucketize([], 3)
  expect(buckets).toHaveLength(3)
  expect(buckets.every((b) => b.avgPrice === 0 && b.volume === 0)).toBe(true)
})

test('bucketize 将累计成交量转为分钟增量并按交易时间分列', () => {
  const points: IntradayPoint[] = [
    { time: '0930', price: 10, volume: 100 },
    { time: '1500', price: 12, volume: 300 },
  ]
  const buckets = bucketize(points, 2)
  expect(buckets).toStrictEqual([
    { avgPrice: 10, maxPrice: 10, minPrice: 10, lastPrice: 10, volume: 100 },
    { avgPrice: 12, maxPrice: 12, minPrice: 12, lastPrice: 12, volume: 200 },
  ])
})

test('bucketize 用前桶价格为区间内空桶续平线, 但不填成交量', () => {
  const points: IntradayPoint[] = [
    { time: '0930', price: 10, volume: 100 },
    { time: '1500', price: 12, volume: 300 },
  ]
  const buckets = bucketize(points, 3)
  expect(buckets[1]).toStrictEqual({ avgPrice: 10, maxPrice: 10, minPrice: 10, lastPrice: 10, volume: 0 })
})

test('bucketize 跳过时间格式非法的数据点', () => {
  const points: IntradayPoint[] = [
    { time: 'xxxx', price: 10, volume: 100 },
    { time: '0930', price: 11, volume: 200 },
  ]
  const buckets = bucketize(points, 1)
  expect(buckets[0]!.lastPrice).toBe(11)
})

test('buildChartRows 返回价格区 + 成交量区 + 时间轴的矩阵尺寸', () => {
  const points: IntradayPoint[] = [
    { time: '0930', price: 10, volume: 100 },
    { time: '1130', price: 10.5, volume: 200 },
    { time: '1500', price: 11, volume: 400 },
  ]
  const priceHeight = 4
  const volumeHeight = 2
  const width = 20
  const rows = buildChartRows({ points, period: 'intraday', prevClose: 10, width, priceHeight, volumeHeight })

  expect(rows).toHaveLength(priceHeight + volumeHeight + 1)
  expect(rows.every((row) => row.length === width)).toBe(true)
})

test('buildChartRows 对空数据不抛错并保持尺寸', () => {
  const rows = buildChartRows({ points: [], period: 'day', width: 10, priceHeight: 3, volumeHeight: 1 })
  expect(rows).toHaveLength(3 + 1 + 1)
  expect(rows.every((row) => row.length === 10)).toBe(true)
})

test('mergeChartCell 合并相邻同色 cell, 颜色变化处断开', () => {
  expect(
    mergeChartCell([{ ch: 'a', color: 'red' }, { ch: 'b', color: 'red' }, { ch: 'c', color: 'gray' }, { ch: 'd' }]),
  ).toStrictEqual([{ ch: 'ab', color: 'red' }, { ch: 'c', color: 'gray' }, { ch: 'd' }])
  expect(mergeChartCell([])).toStrictEqual([])
})

/**
 * buildChartRows 的结果会被 useMemo 缓存, 因此 mergeChartCell 不得就地改写入参: 否则缓存里的 cell
 * 每重渲染都会被再拼接一次, 行宽随重渲染次数增长.
 */
test('mergeChartCell 不改写入参, 同一行重复合并结果一致', () => {
  const rows = buildChartRows({
    points: [
      { time: '0930', price: 10, volume: 100 },
      { time: '1500', price: 11, volume: 400 },
    ],
    period: 'intraday',
    prevClose: 10,
    width: 20,
    priceHeight: 3,
    volumeHeight: 1,
  })
  const axisRow = rows.at(-1)!
  const snapshot = structuredClone(axisRow)

  const once = mergeChartCell(axisRow)
    .map((run) => run.ch)
    .join('')
  const twice = mergeChartCell(axisRow)
    .map((run) => run.ch)
    .join('')

  expect(axisRow).toStrictEqual(snapshot)
  expect(once).toHaveLength(20)
  expect(twice).toBe(once)
})

class CaptureOutput extends Writable {
  readonly columns: number
  readonly rows: number
  readonly isTTY = true
  readonly frames: string[] = []

  constructor(columns: number, rows: number) {
    super()
    this.columns = columns
    this.rows = rows
  }

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.frames.push(chunk.toString())
    callback()
  }
}

const createInput = () => {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean
    setRawMode: (mode: boolean) => PassThrough
    ref: () => PassThrough
    unref: () => PassThrough
  }
  input.isTTY = true
  input.setRawMode = () => input
  input.ref = () => input
  input.unref = () => input
  return input
}

const plain = (frame: string) => stripVTControlCharacters(frame)

const waitForFrame = async (
  output: CaptureOutput,
  after: number,
  predicate: (frame: string) => boolean,
): Promise<string> => {
  const deadline = Date.now() + 2000
  while (Date.now() < deadline) {
    const frame = output.frames.slice(after).findLast(predicate)
    if (frame !== undefined) return frame
    await delay(10)
  }

  throw new Error(`Timed out waiting for frame. Latest output:\n${plain(output.frames.at(-1) ?? '')}`)
}

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
  const instance = render(<ChartHarness tick={0} />, {
    stdout: output as unknown as NodeJS.WriteStream,
    stdin: createInput() as unknown as NodeJS.ReadStream,
    stderr: new PassThrough() as unknown as NodeJS.WriteStream,
    debug: true,
    interactive: false,
    patchConsole: false,
  })

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
