import stringWidth from 'string-width'
import { expect, test } from 'vitest'

import type { Quote } from '../src/api/types.ts'
import { LOCALES } from '../src/i18n/locale.ts'
import type { Locale } from '../src/i18n/types.ts'
import {
  headerRow,
  missingRow,
  quoteRow,
  scaleColumns,
  stockDetailColumns,
  stockListColumns,
  tableWidth,
} from '../src/lib/quoteTable.ts'

const STOCK_LIST_COLUMNS = stockListColumns()
const STOCK_DETAIL_COLUMNS = stockDetailColumns()
const COLUMNS_BY_KEY = new Map(STOCK_LIST_COLUMNS.concat(STOCK_DETAIL_COLUMNS).map((column) => [column.key, column]))

const quote = (patch: Partial<Quote> = {}): Quote => ({
  code: 'sh600000',
  name: '浦发银行',
  current: 10.25,
  prevClose: 10,
  open: 10.1,
  high: 10.3,
  low: 9.95,
  change: 0.25,
  changePercent: 2.5,
  timestamp: '20260820150000',
  volume: 12_345,
  turnover: 6789,
  turnoverRate: 1.2,
  amplitude: 3.5,
  marketCap: 2000,
  volumeRatio: 1.1,
  ...patch,
})

const codeColumn = COLUMNS_BY_KEY.get('code')!
const percentColumn = COLUMNS_BY_KEY.get('changePercent')!

test('stringWidth 将 CJK 字符按两列计算', () => {
  expect(stringWidth('abc')).toBe(3)
  expect(stringWidth('代码')).toBe(4)
  expect(stringWidth('浦发A')).toBe(5)
  expect(stringWidth('')).toBe(0)
})

test('headerRow 补齐列宽并在列间插入分隔空格', () => {
  const [first, second] = headerRow([codeColumn, percentColumn])
  expect(first!.color).toBe('gray')
  expect(second!.color).toBe('gray')
  expect(first!.text.startsWith('代码')).toBe(true)
  expect(second!.text.startsWith('涨跌幅')).toBe(true)
  // 首列宽度 9 + 分隔 1, 末列宽度 9 无分隔
  expect(stringWidth(first!.text)).toBe(codeColumn.width + 1)
  expect(stringWidth(second!.text)).toBe(percentColumn.width)
})

test('quoteRow 按涨跌方向着色, 代码列保持灰色', () => {
  const [code, percent] = quoteRow([codeColumn, percentColumn], quote())
  expect(code!.color).toBe('gray')
  expect(code!.text.startsWith('sh600000')).toBe(true)
  expect(percent!.text.startsWith('+2.50%')).toBe(true)
  expect(percent!.color).toBe('red')
})

test('quoteRow 在涨绿跌红模式下翻转下跌颜色', () => {
  const [, percent] = quoteRow([codeColumn, percentColumn], quote({ change: -0.5, changePercent: -1.2 }), 'green-up')
  expect(percent!.text.startsWith('-1.20%')).toBe(true)
  expect(percent!.color).toBe('red')
})

test('quoteRow 对停牌股票显示占位符并统一灰色', () => {
  const [, percent] = quoteRow([codeColumn, percentColumn], quote({ current: 0 }))
  expect(percent!.text.startsWith('停牌')).toBe(true)
  expect(percent!.color).toBe('gray')
})

test('missingRow 显示代码/名称并对数据列填充占位符', () => {
  const nameColumn = COLUMNS_BY_KEY.get('name')!
  const [code, name, percent] = missingRow([codeColumn, nameColumn, percentColumn], 'sh600000', '浦发银行')
  expect(code!.text.startsWith('sh600000')).toBe(true)
  expect(name!.text.startsWith('浦发银行')).toBe(true)
  expect(percent!.text.startsWith('无数据')).toBe(true)
  expect([code, name, percent].every((cell) => cell!.color === 'gray')).toBe(true)
})

test('列表列以名称/代码开头且不含仅详情使用的列', () => {
  const keys = STOCK_LIST_COLUMNS.map((column) => column.key)
  expect(keys.slice(0, 2)).toStrictEqual(['name', 'code'])
  expect(keys).not.toContain('prevClose')
  expect(keys).not.toContain('amplitude')
  expect(keys).not.toContain('volumeRatio')
})

test('详情列排除标题行已展示的现价与涨跌额', () => {
  const keys = STOCK_DETAIL_COLUMNS.map((column) => column.key)
  expect(keys).not.toContain('current')
  expect(keys).not.toContain('change')
  expect(keys).not.toContain('changePercent')
  expect(keys).toContain('prevClose')
  expect(keys).toContain('amplitude')
})

test('tableWidth = 各列宽之和 + 列间分隔', () => {
  const listSum = STOCK_LIST_COLUMNS.reduce((sum, column) => sum + column.width, 0)
  expect(tableWidth(STOCK_LIST_COLUMNS)).toBe(listSum + STOCK_LIST_COLUMNS.length - 1)

  const detailSum = STOCK_DETAIL_COLUMNS.reduce((sum, column) => sum + column.width, 0)
  expect(tableWidth(STOCK_DETAIL_COLUMNS)).toBe(detailSum + STOCK_DETAIL_COLUMNS.length - 1)
})

test('scaleColumns 在 target === 列宽之和时保持不变', () => {
  const baseSum = STOCK_LIST_COLUMNS.reduce((sum, column) => sum + column.width, 0)
  expect(baseSum).toBe(101)
  const scaled = scaleColumns(STOCK_LIST_COLUMNS, baseSum)
  expect(scaled.map((column) => column.width)).toStrictEqual(STOCK_LIST_COLUMNS.map((column) => column.width))
})

test('scaleColumns 等比例放大, 残差按小数部分从大到小分摊使总和精确等于 target', () => {
  const target = 185
  const scaled = scaleColumns(STOCK_LIST_COLUMNS, target)
  expect(scaled.reduce((sum, column) => sum + column.width, 0)).toBe(target)
  STOCK_LIST_COLUMNS.forEach((column, index) => {
    expect(scaled[index]!.width).toBeGreaterThanOrEqual(column.width)
  })
  expect(scaled.map((column) => column.width)).toStrictEqual([17, 16, 15, 16, 15, 13, 13, 13, 20, 16, 13, 18])
})

test('scaleColumns 残差按小数部分分摊, 小数相同时靠前的列先取 (2 列示例)', () => {
  // 两列比例相同 (各 12.5), 残差 1 归首列, 而不是像以前那样让首列吸收全部残差
  const scaled = scaleColumns([codeColumn, percentColumn], 25)
  expect(scaled.map((column) => column.width)).toStrictEqual([13, 12])
  expect(scaled.reduce((sum, column) => sum + column.width, 0)).toBe(25)
})

/**
 * 124 列的终端曾让首列被压到 6: 名称列窄于 8 列宽的中文名, 整行超宽后末列被折到下一行.
 * scaleColumns 是 cell() 只补齐不截断的前提, 因此任何一列都不得窄于列定义的内容宽度.
 */
test('scaleColumns 不把任何一列压到内容宽度以下 (124 列回归)', () => {
  const scaled = scaleColumns(STOCK_LIST_COLUMNS, 109)
  expect(scaled.map((column) => column.width)).toStrictEqual([10, 10, 9, 10, 9, 7, 7, 7, 12, 10, 7, 11])
})

test('scaleColumns 在 target >= 列宽之和时每列只增不减, 总和精确等于 target', () => {
  for (const locale of LOCALES) {
    const columns = stockListColumns(locale)
    const baseSum = columns.reduce((sum, column) => sum + column.width, 0)
    for (let target = baseSum; target <= baseSum + 60; target += 1) {
      const scaled = scaleColumns(columns, target)
      const label = `${locale} target ${target}`
      expect(
        scaled.reduce((sum, column) => sum + column.width, 0),
        label,
      ).toBe(target)
      columns.forEach((column, index) => {
        expect(scaled[index]!.width, `${label} ${column.key}`).toBeGreaterThanOrEqual(column.width)
      })
    }
  }
})

/* ---------- 多语言列 ---------- */

const LIST_WIDTH_SUM: Record<Locale, number> = { 'zh-hans': 101, 'zh-hant': 101, en: 104 }

test('各 locale 的列表列宽之和稳定, 且 tableWidth 等于列宽之和加分隔', () => {
  for (const locale of LOCALES) {
    const columns = stockListColumns(locale)
    const sum = columns.reduce((total, column) => total + column.width, 0)
    expect(sum, locale).toBe(LIST_WIDTH_SUM[locale])
    expect(tableWidth(columns), locale).toBe(sum + columns.length - 1)
  }
})

test('中文列宽未因多语言改动而变化', () => {
  expect(stockListColumns('zh-hans').map((column) => column.width)).toStrictEqual(
    STOCK_LIST_COLUMNS.map((column) => column.width),
  )
  expect(stockListColumns('zh-hant').map((column) => column.width)).toStrictEqual(
    STOCK_LIST_COLUMNS.map((column) => column.width),
  )
})

test('各 locale 的表头宽度不超过对应列宽', () => {
  for (const locale of LOCALES) {
    for (const column of stockListColumns(locale).concat(stockDetailColumns(locale))) {
      expect(stringWidth(column.title), `${locale} ${column.key}: ${column.title}`).toBeLessThanOrEqual(column.width)
    }
  }
})

test('en 使用本地化表头, 占位文案与单位', () => {
  const byKey = new Map(stockListColumns('en').map((column) => [column.key, column]))
  const percentColumn = byKey.get('changePercent')!

  expect(byKey.get('marketCap')!.title).toBe('Market Cap')
  expect(percentColumn.title).toBe('Change %')
  expect(percentColumn.suspendedText).toBe('Suspended')
  expect(missingRow([percentColumn], 'sh600000', 'Name')[0]!.text.startsWith('No data')).toBe(true)

  expect(byKey.get('volume')!.render(quote({ volume: 611_000 }))).toBe('611.0K lots')
  expect(byKey.get('turnover')!.render(quote({ turnover: 55_000 }))).toBe('550.0M')
  expect(byKey.get('marketCap')!.render(quote({ marketCap: 2987.53 }))).toBe('298.75B')
})

test('zh-hant 使用繁体表头与占位文案', () => {
  const byKey = new Map(stockListColumns('zh-hant').map((column) => [column.key, column]))
  const percentColumn = byKey.get('changePercent')!

  expect(byKey.get('turnoverRate')!.title).toBe('週轉率')
  expect(percentColumn.suspendedText).toBe('暫停交易')
  expect(missingRow([percentColumn], 'sh600000', 'Name')[0]!.text.startsWith('無資料')).toBe(true)
})

/**
 * 各数值列在单位档位边界附近的取值: 档位切换和四舍五入都会在这里放大宽度.
 * 上限取单只股票的合理量级 (成交量 1 亿手, 成交额 1000 亿元, 总市值 10 万亿元).
 */
const UNIT_PROBES: { key: 'volume' | 'turnover' | 'marketCap'; values: number[] }[] = [
  { key: 'volume', values: [1, 999, 1_000, 9_999, 10_000, 999_949, 999_950, 999_999, 1_000_000, 99_999_999] },
  { key: 'turnover', values: [1, 99, 100, 9_999, 10_000, 99_999, 100_000, 9_999_999] },
  { key: 'marketCap', values: [0.01, 1, 9, 10, 9_999, 10_000, 99_999] },
]

test('单位列在档位边界的渲染文本不超出列宽', () => {
  // cell() 只补齐不截断, 超出列宽会撑宽整行并让后续列错位
  for (const locale of LOCALES) {
    const byKey = new Map(stockDetailColumns(locale).map((column) => [column.key, column]))
    for (const { key, values } of UNIT_PROBES) {
      const column = byKey.get(key)!
      for (const value of values) {
        const text = column.render(quote({ [key]: value }))
        expect(stringWidth(text), `${locale} ${key} ${value}: ${text}`).toBeLessThanOrEqual(column.width)
      }
    }
  }
})

test('停牌与缺失占位文案不超出列宽', () => {
  for (const locale of LOCALES) {
    for (const column of stockListColumns(locale).concat(stockDetailColumns(locale))) {
      for (const text of [column.suspendedText, column.missingText]) {
        if (text === undefined) continue
        expect(stringWidth(text), `${locale} ${column.key}: ${text}`).toBeLessThanOrEqual(column.width)
      }
    }
  }
})
