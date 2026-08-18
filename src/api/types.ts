/** 腾讯行情单只股票; 字段索引对应关系见 index.ts 顶部注释 */
export type Quote = {
  code: string // 规范化代码, 如 'sh600000'
  name: string
  current: number // 现价
  prevClose: number // 昨收
  open: number // 今开
  high: number // 最高
  low: number // 最低
  change: number // 涨跌额
  changePercent: number // 涨跌幅 (%)
  timestamp: string // yyyyMMddHHmmss
  volume: number // 成交量 (手)
  turnover: number // 成交额 (万元)
  turnoverRate: number // 换手率 (%)
  amplitude: number // 振幅 (%)
  marketCap: number // 总市值 (亿)
  volumeRatio: number // 量比
}

/** 腾讯分时图单分钟点 (web.ifzq.gtimg.cn/appstock/app/minute/query) */
export type IntradayPoint = {
  time: string // HHMM, 如 '0930'
  price: number
  volume: number // 累计成交量 (手)
}
