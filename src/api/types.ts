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
  /** 累计成交量 (手) */
  volume: number
}
