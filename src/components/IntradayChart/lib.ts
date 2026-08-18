import type { IntradayPoint } from '../../api/types.ts'

export type TextColor = 'red' | 'green' | 'gray'

/** 图表单元格: 字符 + 可选颜色, 行渲染时相邻同色合并 */
export type ChartCell = { ch: string; color?: TextColor }

/** 桶: 一列内的聚合值; 空桶 (无数据) 各字段为 0 */
export type Bucket = {
  avgPrice: number
  maxPrice: number
  minPrice: number
  lastPrice: number
  volume: number
}

/** 交易分钟序号: 09:30=0, 11:30=120, 13:00=120, 15:00=240; 解析失败/越界返回 null (盘前集合竞价点钳到 0) */
export const tradingMinute = (time: string): number | null => {
  if (!/^\d{4}$/.test(time)) return null
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(2)) - 570
  if (minutes < 0) return 0
  if (minutes > 120) return minutes - 90 // 午休 90 分钟
  return minutes
}

/**
 * 把分时点按交易时间比例归入 width 个桶 (午休空隙自然落在午休附近列).
 * 有数据桶之后 (但未到末尾) 的空桶用前桶价格续线 (平线过午休), 尾部空桶留空 (盘中数据未到).
 * 成交量 (接口为累计值) 转分钟增量, 空桶/增量小于等于 0 计 0.
 */
export const bucketize = (points: IntradayPoint[], width: number): Bucket[] => {
  const raw = Array.from({ length: width }, () => ({
    sum: 0,
    count: 0,
    minPrice: 0,
    maxPrice: 0,
    lastPrice: 0,
    volume: 0,
  }))
  let lastFilled = -1
  let prevVolume = 0

  for (const point of points) {
    const minute = tradingMinute(point.time)
    if (minute === null) continue
    const col = Math.min(width - 1, Math.floor((minute / 240) * width))
    const bucket = raw[col]!
    bucket.sum += point.price
    bucket.count += 1
    bucket.minPrice = bucket.count === 1 ? point.price : Math.min(bucket.minPrice, point.price)
    bucket.maxPrice = bucket.count === 1 ? point.price : Math.max(bucket.maxPrice, point.price)
    bucket.lastPrice = point.price
    bucket.volume += Math.max(0, point.volume - prevVolume)
    prevVolume = point.volume
    lastFilled = Math.max(lastFilled, col)
  }

  const buckets: Bucket[] = []
  let lastPrice = 0
  for (let col = 0; col < width; col++) {
    const bucket = raw[col]!
    if (bucket.count > 0) {
      lastPrice = bucket.lastPrice
      buckets.push({
        avgPrice: bucket.sum / bucket.count,
        maxPrice: bucket.maxPrice,
        minPrice: bucket.minPrice,
        lastPrice: bucket.lastPrice,
        volume: bucket.volume,
      })
    } else if (col < lastFilled) {
      // 有数据区间内的缺口 (午休跨列): 平线续接
      buckets.push({ avgPrice: lastPrice, maxPrice: lastPrice, minPrice: lastPrice, lastPrice, volume: 0 })
    } else {
      // 尾部缺口 (盘中数据未到): 留空
      buckets.push({ avgPrice: 0, maxPrice: 0, minPrice: 0, lastPrice: 0, volume: 0 })
    }
  }
  return buckets
}

/**
 * 生成分时图字符矩阵: 价格折线 (2 半行/行, █▀▄ 组合, 整线按收尾价 vs 昨收红绿灰) +
 * 昨收虚线 (╴, 灰, 折线优先) + 成交量柱 (█, 按各桶收尾价 vs 昨收红绿) + 底部时间轴行.
 * 返回 (priceHeight + volumeHeight + 1) 行 × width 列.
 */
export const buildChartRows = (
  points: IntradayPoint[],
  prevClose: number | null,
  width: number,
  priceHeight: number,
  volumeHeight: number,
): ChartCell[][] => {
  const buckets = bucketize(points, width)

  // 价格范围 (含昨收); 全部无数据时兜底防除零
  let rangeMin = Infinity
  let rangeMax = -Infinity
  for (const bucket of buckets) {
    if (bucket.avgPrice <= 0) continue
    rangeMin = Math.min(rangeMin, bucket.minPrice)
    rangeMax = Math.max(rangeMax, bucket.maxPrice)
  }
  if (prevClose !== null) {
    rangeMin = Math.min(rangeMin, prevClose)
    rangeMax = Math.max(rangeMax, prevClose)
  }
  if (!Number.isFinite(rangeMin)) {
    rangeMin = 0
    rangeMax = 1
  }
  if (rangeMax === rangeMin) rangeMax += 1

  const halfRows = priceHeight * 2
  const yOf = (price: number) => Math.round(((rangeMax - price) / (rangeMax - rangeMin)) * (halfRows - 1))

  // 折线整体颜色 (A股惯例): 收尾价 > 昨收红, < 绿, 平灰; 无昨收灰
  const filledLastPrices = buckets.map((b) => b.lastPrice).filter((price) => price > 0)
  const lineColor: TextColor =
    prevClose === null
      ? 'gray'
      : (filledLastPrices.at(-1) ?? 0) > prevClose
        ? 'red'
        : (filledLastPrices.at(-1) ?? 0) < prevClose
          ? 'green'
          : 'gray'

  const rows: ChartCell[][] = Array.from({ length: priceHeight + volumeHeight + 1 }, () =>
    Array.from({ length: width }, () => ({ ch: ' ', color: undefined })),
  )

  // 价格区: 桶的 min-max 半行区间内填充 (区域折线)
  for (let col = 0; col < width; col++) {
    const bucket = buckets[col]!
    if (bucket.avgPrice <= 0) continue
    const yMin = yOf(bucket.maxPrice)
    const yMax = yOf(bucket.minPrice)
    for (let y = yMin; y <= yMax; y++) {
      const row = rows[Math.floor(y / 2)]!
      const ch = y % 2 === 0 ? '▀' : '▄'
      const cell = row[col]!
      if (cell.ch === ' ') cell.ch = ch
      cell.color = lineColor
    }
  }

  // 昨收虚线 (灰, 折线优先)
  if (prevClose !== null) {
    const dashRow = Math.floor(yOf(prevClose) / 2)
    for (let col = 0; col < width; col++) {
      const cell = rows[dashRow]![col]!
      if (cell.ch === ' ') cell.ch = '╴'
      if (!cell.color) cell.color = 'gray'
    }
  }

  // 成交量柱: 底部向上, 至少 1 格防太矮
  const maxVolume = Math.max(...buckets.map((b) => b.volume), 0)
  for (let col = 0; col < width; col++) {
    const bucket = buckets[col]!
    if (bucket.volume <= 0 || maxVolume <= 0) continue
    const bar = Math.max(1, Math.round((bucket.volume / maxVolume) * volumeHeight))
    const color: TextColor =
      prevClose === null
        ? 'gray'
        : bucket.lastPrice > prevClose
          ? 'red'
          : bucket.lastPrice < prevClose
            ? 'green'
            : 'gray'
    for (let i = 0; i < bar; i++) {
      rows[priceHeight + (volumeHeight - 1 - i)]![col] = { ch: '█', color }
    }
  }

  // 时间轴行 (灰)
  const axis = rows[priceHeight + volumeHeight]!
  const putAxis = (col: number, text: string) => {
    for (let i = 0; i < text.length && col + i < width; i++) axis[col + i] = { ch: text[i]!, color: 'gray' }
  }
  putAxis(0, '09:30')
  putAxis(Math.floor(width / 2) - 5, '11:30/13:00')
  putAxis(width - 5, '15:00')

  return rows
}
