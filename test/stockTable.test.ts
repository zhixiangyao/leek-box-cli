import { expect, test } from 'vitest'

import {
  STOCK_DETAIL_COLUMNS,
  stockDetailColumnsWidth,
  STOCK_LIST_COLUMNS,
  stockListColumnsWidth,
} from '../src/lib/stockTable.ts'

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

test('表格总宽 = 各列宽之和 + 列间分隔', () => {
  const listSum = STOCK_LIST_COLUMNS.reduce((sum, column) => sum + column.width, 0)
  expect(stockListColumnsWidth()).toBe(listSum + STOCK_LIST_COLUMNS.length - 1)

  const detailSum = STOCK_DETAIL_COLUMNS.reduce((sum, column) => sum + column.width, 0)
  expect(stockDetailColumnsWidth()).toBe(detailSum + STOCK_DETAIL_COLUMNS.length - 1)
})
