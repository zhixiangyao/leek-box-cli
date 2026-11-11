import { expect, test } from 'vitest'

import type { FiveDayPoint, HistoricalPoint, IntradayPoint } from '../src/api/types.ts'
import { bucketize, buildChartRows, mergeChartCell } from '../src/components/StockChart/lib.ts'

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

test('bucketize 同一桶内的最高最低价取实际极值', () => {
  const points: IntradayPoint[] = [
    { time: '0930', price: 10, volume: 100 },
    { time: '0931', price: 9.5, volume: 120 },
    { time: '0932', price: 11, volume: 150 },
  ]
  const [bucket] = bucketize(points, 1)
  expect(bucket).toMatchObject({ maxPrice: 11, minPrice: 9.5, lastPrice: 11, volume: 150 })
  expect(bucket!.avgPrice).toBeCloseTo(30.5 / 3)
})

test('buildChartRows 五日图按交易日分段并在时间轴标注日期', () => {
  const points: FiveDayPoint[] = [
    { time: '0930', price: 10, volume: 100, sessionDate: '2026-08-19', prevClose: 9.9 },
    { time: '1500', price: 10.6, volume: 250, sessionDate: '2026-08-19', prevClose: 9.9 },
    { time: '0930', price: 9.8, volume: 90, sessionDate: '2026-08-18', prevClose: 10.1 },
    { time: '1500', price: 10.2, volume: 220, sessionDate: '2026-08-18', prevClose: 10.1 },
  ]
  const rows = buildChartRows({ points, period: 'five-day', width: 20, priceHeight: 4, volumeHeight: 2 })
  const axis = rows
    .at(-1)!
    .map((cell) => cell.ch)
    .join('')

  // 会话按日期升序排列, 时间轴标签取 YYYY-MM-DD 的后五位
  expect(axis).toContain('08-18')
  expect(axis).toContain('08-19')
  expect(rows).toHaveLength(4 + 2 + 1)
})

test('buildChartRows 五日图无数据或宽度不足时保持尺寸', () => {
  const emptyRows = buildChartRows({ points: [], period: 'five-day', width: 10, priceHeight: 3, volumeHeight: 1 })
  expect(emptyRows).toHaveLength(3 + 1 + 1)
  expect(emptyRows.every((row) => row.length === 10)).toBe(true)

  const points: FiveDayPoint[] = [
    { time: '0930', price: 10, volume: 100, sessionDate: '2026-08-18', prevClose: 9.9 },
    { time: '1500', price: 10.2, volume: 200, sessionDate: '2026-08-19', prevClose: 10.1 },
  ]
  // 宽度小于会话数: 后面的会话分不到列, 跳过而不是抛错
  const rows = buildChartRows({ points, period: 'five-day', width: 1, priceHeight: 2, volumeHeight: 1 })
  expect(rows).toHaveLength(2 + 1 + 1)
  expect(rows.every((row) => row.length === 1)).toBe(true)
})

test('buildChartRows 历史 K 线按周期生成时间轴标签', () => {
  const points: HistoricalPoint[] = [
    { date: '2026-08-17', open: 10, close: 10.2, high: 10.4, low: 9.8, volume: 1000 },
    { date: '2026-08-18', open: 10.2, close: 10.3, high: 10.5, low: 10, volume: 1200 },
    { date: '2026-08-19', open: 10.3, close: 10.6, high: 10.8, low: 10.1, volume: 900 },
  ]
  const expected: Record<'day' | 'week' | 'month' | 'year', [string, string]> = {
    day: ['08-17', '08-19'],
    week: ['26-08-17', '26-08-19'],
    month: ['2026-08', '2026-08'],
    year: ['2026', '2026'],
  }

  for (const [period, [first, last]] of Object.entries(expected) as [
    'day' | 'week' | 'month' | 'year',
    [string, string],
  ][]) {
    const rows = buildChartRows({ points, period, width: 24, priceHeight: 4, volumeHeight: 2 })
    const axis = rows
      .at(-1)!
      .map((cell) => cell.ch)
      .join('')
    expect(axis, period).toContain(first)
    expect(axis, period).toContain(last)
  }

  // 宽度为 1 时历史插值位置固定为第一根 K 线
  const narrow = buildChartRows({ points, period: 'day', width: 1, priceHeight: 2, volumeHeight: 1 })
  expect(narrow).toHaveLength(2 + 1 + 1)
})

test('buildChartRows 分时中间缺口不连线, 尾部留空', () => {
  const points: IntradayPoint[] = [
    { time: '0930', price: 10, volume: 100 },
    { time: '1500', price: 12, volume: 300 },
  ]
  // 没有昨收时基准线不绘制, 不抛错
  const rows = buildChartRows({ points, period: 'intraday', width: 3, priceHeight: 4, volumeHeight: 2 })
  expect(rows).toHaveLength(4 + 2 + 1)
  expect(rows.every((row) => row.length === 3)).toBe(true)
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
