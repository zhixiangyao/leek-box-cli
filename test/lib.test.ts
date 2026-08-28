import { expect, test } from 'vitest'

import { visibleWindow } from '../src/screens/StockList/lib.ts'

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
