import type { ChartPeriod, ChartPoint, FiveDayPoint, HistoricalPoint, IntradayPoint } from '../../api/types.ts'

type TextColor = 'red' | 'green' | 'gray'

/** 图表单元格: 字符 + 可选颜色, 行渲染时相邻同色合并 */
export type ChartCell = { ch: string; color?: TextColor }

/** 桶: 一列内的聚合值; 空桶 (无数据) 各字段为 0 */
type Bucket = {
  avgPrice: number
  maxPrice: number
  minPrice: number
  lastPrice: number
  volume: number
}

/** 交易分钟序号: 09:30=0, 11:30=120, 13:00=120, 15:00=240; 解析失败/越界返回 undefined (盘前集合竞价点钳到 0) */
const tradingMinute = (time: string): number | undefined => {
  if (!/^\d{4}$/.test(time)) return undefined
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
  if (width <= 0) return []

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
    if (minute === undefined) continue
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

const isHistoricalPoint = (point: ChartPoint): point is HistoricalPoint => 'date' in point
const isFiveDayPoint = (point: ChartPoint): point is FiveDayPoint => 'sessionDate' in point
const isIntradayPoint = (point: ChartPoint): point is IntradayPoint =>
  !isHistoricalPoint(point) && !isFiveDayPoint(point)

/** 把五个交易日分别映射到等宽分段; 每日独立计算累计成交量增量 */
const bucketizeFiveDay = (points: FiveDayPoint[], width: number): Bucket[] => {
  const sessions = new Map<string, FiveDayPoint[]>()
  for (const point of points) {
    const session = sessions.get(point.sessionDate) ?? []
    session.push(point)
    sessions.set(point.sessionDate, session)
  }
  const orderedSessions = [...sessions.entries()].sort(([left], [right]) => left.localeCompare(right))
  if (orderedSessions.length === 0) {
    return Array.from({ length: width }, () => ({
      avgPrice: 0,
      maxPrice: 0,
      minPrice: 0,
      lastPrice: 0,
      volume: 0,
    }))
  }

  const buckets: Bucket[] = []
  for (let index = 0; index < orderedSessions.length; index++) {
    const start = Math.floor((index / orderedSessions.length) * width)
    const end = Math.floor(((index + 1) / orderedSessions.length) * width)
    const segmentWidth = end - start
    if (segmentWidth <= 0) continue
    const sessionPoints = orderedSessions[index]![1].sort((left, right) => left.time.localeCompare(right.time))
    buckets.push(...bucketize(sessionPoints, segmentWidth))
  }
  return buckets
}

/** 把历史 K 线均匀铺满图表宽度; 收盘价线性插值, 每列沿用最近 K 线成交量 */
const bucketizeHistorical = (points: HistoricalPoint[], width: number): Bucket[] => {
  if (points.length === 0) {
    return Array.from({ length: width }, () => ({
      avgPrice: 0,
      maxPrice: 0,
      minPrice: 0,
      lastPrice: 0,
      volume: 0,
    }))
  }

  return Array.from({ length: width }, (_, col) => {
    const position = width <= 1 ? 0 : (col / (width - 1)) * (points.length - 1)
    const left = points[Math.floor(position)]!
    const right = points[Math.min(Math.ceil(position), points.length - 1)]!
    const ratio = position - Math.floor(position)
    const price = left.close + (right.close - left.close) * ratio
    const nearest = points[Math.round(position)]!
    return {
      avgPrice: price,
      maxPrice: Math.max(left.high, right.high),
      minPrice: Math.min(left.low, right.low),
      lastPrice: price,
      volume: nearest.volume,
    }
  })
}

/**
 * Braille 点阵: 每字符 2 子列 × 4 子行. 子行 0-2 走 6 点码位 (位 = 1 << (r + c*3)),
 * 子行 3 用 8 点制的 dot7/dot8 (位 = 1 << (6 + c)), c 为子列奇偶 (0 左 / 1 右).
 */
const DOT_BIT = (c: number, r: number): number => (r < 3 ? 1 << (r + c * 3) : 1 << (6 + c))

/** Braille 字符: U+2800 + 点阵位掩码 */
const braille = (mask: number): string => String.fromCharCode(0x2800 + mask)

/**
 * 生成行情图字符矩阵: 价格折线 (Braille 2×4 点阵, 垂直 4 倍 + 水平 2 倍分辨率; 子列间按相邻桶
 * lastPrice 线性插值, 陡坡补垂直间隙; 分时整线按现价 vs 昨收红绿灰, 历史按相邻价格段红绿灰)
 * + 分时昨收虚线 (Braille 点, 2 子列开 1 子列停, 灰, 折线优先) + 成交量柱 (Braille 点阵,
 * 双子列整列填, 高度 4×volumeHeight 档, 按各桶相对上一桶涨跌红绿, 首桶回退比较基准, 平盘灰)
 * + 底部时间轴行.
 * 返回 (priceHeight + volumeHeight + 1) 行 × width 列.
 */
export const buildChartRows = (params: {
  points: ChartPoint[]
  period: ChartPeriod
  prevClose?: number
  width: number
  priceHeight: number
  volumeHeight: number
}): ChartCell[][] => {
  const { points, period, prevClose, width, priceHeight, volumeHeight } = params
  const intradayPoints = points.filter(isIntradayPoint)
  const fiveDayPoints = points.filter(isFiveDayPoint)
  const historicalPoints = points.filter(isHistoricalPoint)
  const intradayChart = period === 'intraday'
  const fiveDayChart = period === 'five-day'
  const buckets = intradayChart
    ? bucketize(intradayPoints, width)
    : fiveDayChart
      ? bucketizeFiveDay(fiveDayPoints, width)
      : bucketizeHistorical(historicalPoints, width)
  // K 线与五日图不绘制全宽基准线, 避免走势被视觉上"闭合"; 基准价只用于首根量柱颜色
  const referencePrice = intradayChart
    ? prevClose
    : fiveDayChart
      ? fiveDayPoints[0]?.prevClose
      : historicalPoints[0]?.close
  const referenceLinePrice = intradayChart ? prevClose : undefined

  // 价格范围 (分时图含昨收); 全部无数据时兜底防除零
  let rangeMin = Infinity
  let rangeMax = -Infinity
  for (const bucket of buckets) {
    if (bucket.avgPrice <= 0) continue
    rangeMin = Math.min(rangeMin, bucket.minPrice)
    rangeMax = Math.max(rangeMax, bucket.maxPrice)
  }
  if (referenceLinePrice !== undefined) {
    rangeMin = Math.min(rangeMin, referenceLinePrice)
    rangeMax = Math.max(rangeMax, referenceLinePrice)
  }
  if (!Number.isFinite(rangeMin)) {
    rangeMin = 0
    rangeMax = 1
  }
  if (rangeMax === rangeMin) rangeMax += 1

  const subRows = priceHeight * 4
  const subCols = width * 2
  const yOf = (price: number) => Math.round(((rangeMax - price) / (rangeMax - rangeMin)) * (subRows - 1))
  const compareColor = (price: number, baseline: number | undefined): TextColor =>
    baseline === undefined ? 'gray' : price > baseline ? 'red' : price < baseline ? 'green' : 'gray'

  // 当日分时沿用整线相对昨收的颜色; 五日与 K 线按每段价格方向着色.
  const filledLastPrices = buckets.map((b) => b.lastPrice).filter((price) => price > 0)
  const intradayLineColor = compareColor(filledLastPrices.at(-1) ?? 0, referencePrice)
  const lineColors = buckets.map((bucket, col): TextColor => {
    if (intradayChart) return intradayLineColor
    if (bucket.lastPrice <= 0) return 'gray'

    // 当前 Braille 单元格包含从本桶朝下一桶延伸的半段, 优先按下一桶方向着色.
    const nextPrice = buckets[col + 1]?.lastPrice
    if (nextPrice !== undefined && nextPrice > 0) return compareColor(nextPrice, bucket.lastPrice)

    const previousPrice = buckets[col - 1]?.lastPrice
    return compareColor(bucket.lastPrice, previousPrice !== undefined && previousPrice > 0 ? previousPrice : undefined)
  })

  const rows: ChartCell[][] = Array.from({ length: priceHeight + volumeHeight + 1 }, () =>
    Array.from({ length: width }, () => ({ ch: ' ', color: undefined })),
  )

  // 价格区折线: 每子列一个点 (Braille 2 子列 × 4 子行), 相邻子列陡坡在右侧子列补垂直间隙
  const line = Array.from({ length: priceHeight }, () => new Uint16Array(width))
  let lastFilledCol = -1
  for (let col = 0; col < width; col++) {
    if (buckets[col]!.avgPrice > 0) lastFilledCol = col
  }
  let prevY: number | undefined = undefined
  for (let s = 0; s < subCols; s++) {
    const pos = s / 2
    if (pos > lastFilledCol) {
      prevY = undefined // 尾部留空 (盘中数据未到), 不跨空隙连线
      continue
    }
    const left = buckets[Math.floor(pos)]!
    if (left.avgPrice <= 0) {
      prevY = undefined
      continue
    }
    const right = buckets[Math.min(Math.floor(pos) + 1, width - 1)]!
    // 右桶无数据 (尾部收尾) 时平线, 否则相邻桶 lastPrice 线性插值
    const price =
      right.avgPrice > 0
        ? left.lastPrice + (right.lastPrice - left.lastPrice) * (pos - Math.floor(pos))
        : left.lastPrice
    const y = yOf(price)
    const col = Math.floor(s / 2)
    const lineRow = line[Math.floor(y / 4)]!
    lineRow[col] = lineRow[col]! | DOT_BIT(s % 2, y % 4)
    if (prevY !== undefined) {
      const lo = Math.min(prevY, y)
      const hi = Math.max(prevY, y)
      for (let yy = lo + 1; yy < hi; yy++) {
        const gapRow = line[Math.floor(yy / 4)]!
        gapRow[col] = gapRow[col]! | DOT_BIT(s % 2, yy % 4)
      }
    }
    prevY = y
  }

  // 仅分时图绘制昨收虚线; 历史首日价格只作比较基准, 不参与图形闭合.
  const dash = Array.from({ length: priceHeight }, () => new Uint16Array(width))
  if (referenceLinePrice !== undefined) {
    const y = yOf(referenceLinePrice)
    const cellRow = Math.floor(y / 4)
    for (let s = 0; s < subCols; s++) {
      if (s % 3 === 2) continue
      const col = Math.floor(s / 2)
      if (line[cellRow]![col] !== 0) continue
      const dashRow = dash[cellRow]!
      dashRow[col] = dashRow[col]! | DOT_BIT(s % 2, y % 4)
    }
  }

  // 组装价格区单元格: 折线颜色优先, 否则虚线灰色
  for (let r = 0; r < priceHeight; r++) {
    for (let c = 0; c < width; c++) {
      const mask = line[r]![c]! | dash[r]![c]!
      if (mask === 0) continue
      rows[r]![c] = { ch: braille(mask), color: line[r]![c]! !== 0 ? lineColors[c] : 'gray' }
    }
  }

  // 成交量柱: 底部向上, Braille 点阵 (每字符 4 子行, 双子列整列填 = 实心柱),
  // 高度 4×volumeHeight 档, 至少 1 子行防太矮
  const vol = Array.from({ length: volumeHeight }, () => new Uint16Array(width))
  const maxVolume = Math.max(...buckets.map((b) => b.volume), 0)
  for (let col = 0; col < width; col++) {
    const bucket = buckets[col]!
    if (bucket.volume <= 0 || maxVolume <= 0) continue
    const totalSubRows = volumeHeight * 4
    const barSubRows = Math.max(1, Math.round((bucket.volume / maxVolume) * totalSubRows))
    for (let sr = totalSubRows - barSubRows; sr < totalSubRows; sr++) {
      const volRow = vol[Math.floor(sr / 4)]!
      volRow[col] = volRow[col]! | DOT_BIT(0, sr % 4) | DOT_BIT(1, sr % 4)
    }
  }

  // 组装成交量区单元格: 由各子行位掩码合成 Braille 字符; 颜色按该桶相对上一桶涨跌
  // (分钟方向, 同股票软件红绿交替), 首桶回退昨收, 平盘灰
  const barColor: (TextColor | undefined)[] = Array.from({ length: width }, () => undefined)
  let prevBarPrice: number | undefined = referencePrice
  for (let col = 0; col < width; col++) {
    const bucket = buckets[col]!
    if (bucket.lastPrice <= 0) continue
    barColor[col] =
      prevBarPrice === undefined
        ? 'gray'
        : bucket.lastPrice > prevBarPrice
          ? 'red'
          : bucket.lastPrice < prevBarPrice
            ? 'green'
            : 'gray'
    prevBarPrice = bucket.lastPrice
  }
  for (let r = 0; r < volumeHeight; r++) {
    for (let c = 0; c < width; c++) {
      const mask = vol[r]![c]!
      if (mask === 0) continue
      rows[priceHeight + r]![c] = { ch: braille(mask), color: barColor[c] }
    }
  }

  // 时间轴节点同时驱动标签和竖向虚线, 确保两者严格对齐.
  const axisTicks: { col: number; labelCol: number; label: string }[] = []
  const centeredLabelCol = (col: number, label: string) =>
    Math.max(0, Math.min(width - label.length, col - Math.floor(label.length / 2)))
  if (intradayChart) {
    const middleLabel = '11:30/13:00'
    axisTicks.push(
      { col: 0, labelCol: 0, label: '09:30' },
      {
        col: Math.floor(width / 2),
        labelCol: Math.max(0, Math.floor((width - middleLabel.length) / 2)),
        label: middleLabel,
      },
      { col: width - 1, labelCol: Math.max(0, width - 5), label: '15:00' },
    )
  } else if (fiveDayChart && fiveDayPoints.length > 0) {
    const sessionDates = [...new Set(fiveDayPoints.map((point) => point.sessionDate))].sort()
    for (let index = 0; index < sessionDates.length; index++) {
      const col = Math.min(width - 1, Math.floor(((index + 0.5) / sessionDates.length) * width))
      const label = sessionDates[index]!.slice(5)
      axisTicks.push({ col, labelCol: centeredLabelCol(col, label), label })
    }
  } else if (historicalPoints.length > 0) {
    const dateLabel = (point: HistoricalPoint) => {
      if (period === 'year') return point.date.slice(0, 4)
      if (period === 'month') return point.date.slice(0, 7)
      if (period === 'week') return point.date.slice(2)
      return point.date.slice(5)
    }
    const first = dateLabel(historicalPoints[0]!)
    const middle = dateLabel(historicalPoints[Math.floor((historicalPoints.length - 1) / 2)]!)
    const last = dateLabel(historicalPoints.at(-1)!)
    axisTicks.push(
      { col: 0, labelCol: 0, label: first },
      {
        col: Math.floor(width / 2),
        labelCol: Math.max(0, Math.floor((width - middle.length) / 2)),
        label: middle,
      },
      { col: width - 1, labelCol: Math.max(0, width - last.length), label: last },
    )
  }

  // 从时间节点沿 Y 轴绘制灰色竖向虚线; 只填空白单元格, 不覆盖价格线或成交量柱.
  for (const { col } of axisTicks) {
    for (let r = 0; r < priceHeight + volumeHeight; r++) {
      if (rows[r]![col]!.ch === ' ') rows[r]![col] = { ch: '┊', color: 'gray' }
    }
  }

  // 时间轴行 (灰)
  const axis = rows[priceHeight + volumeHeight]!
  const putAxis = (col: number, text: string) => {
    for (let i = 0; i < text.length && col + i < width; i++) axis[col + i] = { ch: text[i]!, color: 'gray' }
  }
  for (const tick of axisTicks) putAxis(tick.labelCol, tick.label)

  return rows
}
