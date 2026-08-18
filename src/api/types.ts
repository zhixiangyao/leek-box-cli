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
}
