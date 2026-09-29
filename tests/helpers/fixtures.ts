import type { Quote } from '../../src/api/types.ts'
import type { StockEntry } from '../../src/settings/schema.ts'
import type { StockListRow } from '../../src/stores/useStockListStore.ts'
import type { StockRemoveEntry } from '../../src/stores/useStockRemoveStore.ts'

/**
 * 行情字面量: 只列用例关心的字段, 其余取固定值.
 * 单位用例断言的就是 volume/turnover/marketCap 这三个数 (见 tests/quoteTable.test.ts).
 */
export const quote = (overrides: Partial<Quote> = {}): Quote => ({
  code: 'sh600000',
  name: '浦发银行',
  current: 10,
  prevClose: 10,
  open: 10.1,
  high: 10.3,
  low: 9.95,
  change: 0.25,
  changePercent: 2.5,
  timestamp: '20260820150000',
  volume: 611_000,
  turnover: 55_000,
  turnoverRate: 1.2,
  amplitude: 3.5,
  marketCap: 2987.53,
  volumeRatio: 1.1,
  ...overrides,
})

/** 只关心涨跌幅的行情行 */
export const quoteRow = (code: string, changePercent: number): StockListRow => ({
  kind: 'quote',
  code,
  quote: quote({ code, changePercent }),
})

/** 行情没返回该代码的行: 名称与数值都由列元数据给出占位文案 */
export const missingRow = (code: string): StockListRow => ({ kind: 'missing', code })

export const rowCodes = (rows: StockListRow[]) => rows.map((row) => row.code)

export const stockEntry = (code: string): StockEntry => ({ code, addedAt: '2026-08-20T00:00:00.000Z' })

/** 删除网格/确认弹窗的条目: 名称来自实时行情, 行情取不到时为 undefined */
export const removeEntry = (code: string, name?: string): StockRemoveEntry => ({ code, name })
