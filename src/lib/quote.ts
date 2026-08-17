/**
 * 腾讯行情接口封装 (https://qt.gtimg.cn/q=...)
 * - 免费无需鉴权, 返回 GBK 编码文本: v_sh600000="字段1~字段2~...";v_sz000001="..."
 * - 字段以 ~ 分隔, 索引: 1=名称 2=代码 3=现价 4=昨收 5=今开 6=成交量(手)
 *   30=时间(yyyyMMddHHmmss) 31=涨跌额 32=涨跌幅(%) 33=最高 34=最低
 * - 无效代码会被接口静默丢弃; 全部无效时返回 v_pv_none_match="1";
 * - 停牌/退市股返回现价 0 的记录, 由调用方判定
 */

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

const FETCH_TIMEOUT_MS = 8000

/** 股票代码规范化: 支持 600000 / sh600000 / SH600000 / 600000.SH, 输出 'sh600000' 或 null */
export function normalizeCode(input: string): string | null {
  let code = input.trim().toUpperCase()
  // 去掉 .SH / .SZ / .BJ 后缀
  code = code.replace(/\.(SH|SZ|BJ)$/, '')
  // 去掉 SH / SZ / BJ 前缀
  code = code.replace(/^(SH|SZ|BJ)/, '')
  if (!/^\d{6}$/.test(code)) return null

  let prefix: string
  if (code.startsWith('6') || code.startsWith('5')) {
    prefix = 'sh'
  } else if (code.startsWith('0') || code.startsWith('1') || code.startsWith('3')) {
    prefix = 'sz'
  } else if (code.startsWith('4') || code.startsWith('8') || code.startsWith('92')) {
    prefix = 'bj'
  } else {
    return null
  }
  return `${prefix}${code}`
}

/** 拉取一批股票代码的实时行情; 无效代码被接口丢弃, 返回结果可能少于请求 */
export async function fetchQuotes(codes: string[]): Promise<Quote[]> {
  if (codes.length === 0) return []

  const res = await fetch(`https://qt.gtimg.cn/q=${codes.join(',')}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`行情接口请求失败: HTTP ${res.status}`)
  }

  // 接口返回 GBK 编码, 必须 arrayBuffer 后解码 (Node full-ICU 支持 'gbk')
  const buf = await res.arrayBuffer()
  const text = new TextDecoder('gbk').decode(buf)

  const quotes: Quote[] = []
  for (const part of text.split(';')) {
    const match = /^v_([a-z]{2}\d{6})="([^"]*)"/.exec(part.trim())
    if (!match) continue
    const fields = match[2]!.split('~')
    if (fields.length < 35) continue

    const name = fields[1]!.trim()
    if (!name) continue

    const parseField = (index: number) => {
      const value = parseFloat(fields[index]!)
      return Number.isFinite(value) ? value : 0
    }

    quotes.push({
      code: match[1]!,
      name,
      current: parseField(3),
      prevClose: parseField(4),
      open: parseField(5),
      high: parseField(33),
      low: parseField(34),
      change: parseField(31),
      changePercent: parseField(32),
      timestamp: fields[30]!,
    })
  }

  if (quotes.length === 0) {
    throw new Error('未查询到任何行情数据, 请检查股票代码')
  }
  return quotes
}
