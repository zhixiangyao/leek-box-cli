import { expect, test } from 'vitest'

import type { IntradayPoint } from '../src/api/types.ts'
import { bucketize, buildChartRows } from '../src/components/StockChart/lib.ts'

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
