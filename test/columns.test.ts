import { expect, test } from 'vitest'

import stringWidth from 'string-width'

import type { Quote } from '../src/api/types.ts'
import { COLUMNS_BY_KEY, headerRow, missingRow, quoteRow } from '../src/lib/columns.ts'

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
