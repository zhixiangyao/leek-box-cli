export type Quote = {
  /** 股票代码 */
  code: string
  /** 股票名称 */
  name: string
  /** 现价 */
  current: number
  /** 昨收 */
  prevClose: number
  /** 今开 */
  open: number
  /** 最高 */
  high: number
  /** 最低 */
  low: number
  /** 涨跌额 */
  change: number
  /** 涨跌幅 (%) */
  changePercent: number
  /** yyyyMMddHHmmss */
  timestamp: string
  /** 成交量 (手) */
  volume: number
  /** 成交额 (万元) */
  turnover: number
  /** 换手率 (%) */
  turnoverRate: number
  /** 振幅 (%) */
  amplitude: number
  /** 总市值 (亿) */
  marketCap: number
  /** 量比 */
  volumeRatio: number
}

export type IntradayPoint = {
  /** HHMM */
  time: string
  price: number
  /** 当日累计成交量 (手) */
  volume: number
}

export type FiveDayPoint = IntradayPoint & {
  /** YYYY-MM-DD */
  sessionDate: string
  /** 当日昨收 */
  prevClose: number
}

export type HistoricalPoint = {
  /** YYYY-MM-DD */
  date: string
  open: number
  high: number
  low: number
  close: number
  /** 当前 K 线周期内成交量 (手) */
  volume: number
}

export type KlinePeriod = 'day' | 'week' | 'month' | 'year'
export type KlineGranularity = Exclude<KlinePeriod, 'year'>
export type KlineAdjustment = 'qfq' | 'hfq'
export type ChartPeriod = 'intraday' | 'five-day' | KlinePeriod
export type ChartPoint = IntradayPoint | FiveDayPoint | HistoricalPoint
