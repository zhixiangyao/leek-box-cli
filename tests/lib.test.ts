import { expect, test } from 'vitest'

import { visibleWindow } from '../src/screens/StockList/lib.ts'
import { gridColumnCount } from '../src/screens/StockRemove/lib.ts'

test('visibleWindow 将两端的偏移量限制在有效范围内', () => {
  expect(visibleWindow(3, 10, 5)).toStrictEqual({ start: 0, end: 3 })
  expect(visibleWindow(10, -2, 3)).toStrictEqual({ start: 0, end: 3 })
  expect(visibleWindow(10, 99, 3)).toStrictEqual({ start: 7, end: 10 })
})

test('visibleWindow 在内容不超过可视高度时展示全部', () => {
  expect(visibleWindow(3, 0, 3)).toStrictEqual({ start: 0, end: 3 })
  expect(visibleWindow(0, 0, 5)).toStrictEqual({ start: 0, end: 0 })
})

test('visibleWindow 保留窗口在偏移量处而不与选中行绑定', () => {
  expect(visibleWindow(10, 4, 3)).toStrictEqual({ start: 4, end: 7 })
  expect(visibleWindow(10, 0, 3)).toStrictEqual({ start: 0, end: 3 })
})

// 屏幕上实际使用的列间距
const GAP = 2

test('gridColumnCount 按终端宽度放下尽可能多的最小单元格', () => {
  // 内容区宽度 = 终端宽度 - 4, 每列占最小单元格宽度 24 再加列间距
  expect(gridColumnCount(80, GAP)).toBe(3) // 内容区 76: 3 * 24 + 2 * 2 = 76, 刚好放下
  expect(gridColumnCount(79, GAP)).toBe(2)
  expect(gridColumnCount(119, GAP)).toBe(4) // 宽度守卫给出的最小终端宽度
  expect(gridColumnCount(140, GAP)).toBe(5)
  expect(gridColumnCount(164, GAP)).toBe(6)
})

test('gridColumnCount 把列间距计入每格宽度', () => {
  // 内容区 136: 间距 2 时 5 * 24 + 4 * 2 = 128 放得下, 间距 12 时 5 * 24 + 4 * 12 = 168 放不下
  expect(gridColumnCount(140, 2)).toBe(5)
  expect(gridColumnCount(140, 12)).toBe(4)
})

test('gridColumnCount 将列数钳制在上下限内', () => {
  expect(gridColumnCount(0, GAP)).toBe(2) // 终端宽度未知或过窄
  expect(gridColumnCount(40, GAP)).toBe(2)
  expect(gridColumnCount(400, GAP)).toBe(8)
})
