import type { HistoricalPoint, IntradayPoint, Quote } from './types.ts'

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined

const numericField = (fields: string[], index: number) => {
  const value = Number.parseFloat(fields[index] ?? '')
  return Number.isFinite(value) ? value : 0
}

/** 解析腾讯 GBK 解码后的实时行情文本. */
export function parseQuoteText(text: string): Quote[] {
  const quotes: Quote[] = []
  for (const part of text.split(';')) {
    const match = /^v_([a-z]{2}\d{6})="([^"]*)"/.exec(part.trim())
    if (!match) continue
    const fields = match[2]!.split('~')
    if (fields.length < 50) continue

    const name = fields[1]!.trim()
    if (!name) continue

    quotes.push({
      code: match[1]!,
      name,
      current: numericField(fields, 3),
      prevClose: numericField(fields, 4),
      open: numericField(fields, 5),
      high: numericField(fields, 33),
      low: numericField(fields, 34),
      change: numericField(fields, 31),
      changePercent: numericField(fields, 32),
      timestamp: fields[30]!,
      volume: numericField(fields, 36),
      turnover: numericField(fields, 37),
      turnoverRate: numericField(fields, 38),
      amplitude: numericField(fields, 43),
      marketCap: numericField(fields, 45),
      volumeRatio: numericField(fields, 49),
    })
  }

  if (quotes.length === 0) throw new Error('未查询到任何行情数据, 请检查股票代码')
  return quotes
}

/** 解析腾讯分时接口响应; 缺失或格式错误的数据按空数组处理. */
export function parseIntradayResponse(value: unknown, code: string): IntradayPoint[] {
  const root = asRecord(value)
  const data = asRecord(root?.['data'])
  const stock = asRecord(data?.[code])
  const stockData = asRecord(stock?.['data'])
  const rows = stockData?.['data']
  if (!Array.isArray(rows)) return []

  const points: IntradayPoint[] = []
  for (const row of rows) {
    if (typeof row !== 'string') continue
    const [time = '', priceText = '', volumeText = ''] = row.split(' ')
    if (!/^(?:[01]\d|2[0-3])[0-5]\d$/.test(time) || time > '1500') continue
    const price = Number.parseFloat(priceText)
    if (!Number.isFinite(price) || price <= 0) continue
    const volume = Number.parseFloat(volumeText)
    points.push({ time, price, volume: Number.isFinite(volume) ? volume : 0 })
  }
  return points
}

/** 解析腾讯前复权日线响应; 行格式为日期、开、收、高、低、成交量. */
export function parseHistoricalResponse(value: unknown, code: string): HistoricalPoint[] {
  const root = asRecord(value)
  const data = asRecord(root?.['data'])
  const stock = asRecord(data?.[code])
  const rows = stock?.['qfqday'] ?? stock?.['day']
  if (!Array.isArray(rows)) return []

  const points: HistoricalPoint[] = []
  const parseNumber = (field: unknown): number => {
    const parsed = Number.parseFloat(typeof field === 'string' || typeof field === 'number' ? String(field) : '')
    return Number.isFinite(parsed) ? parsed : 0
  }
  for (const row of rows) {
    if (!Array.isArray(row)) continue
    const [date, openText, closeText, highText, lowText, volumeText] = row
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const open = parseNumber(openText)
    const close = parseNumber(closeText)
    const high = parseNumber(highText)
    const low = parseNumber(lowText)
    const volume = parseNumber(volumeText)
    if ([open, close, high, low].some((field) => field <= 0)) continue
    points.push({ date, open, close, high, low, volume: Math.max(0, volume) })
  }
  return points
}
