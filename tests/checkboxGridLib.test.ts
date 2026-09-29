import { expect, test } from 'vitest'

import {
  gridColumnCount,
  nextCursor,
  rowWindow,
  scrollForCursor,
  toGridRows,
} from '../src/components/CheckboxGrid/lib.ts'
import { TABLE_CHROME } from '../src/components/WindowSizeGuard.tsx'

test('toGridRows 行优先切分, 末行可不足列数', () => {
  expect(toGridRows([1, 2, 3, 4, 5], 3)).toStrictEqual([
    [1, 2, 3],
    [4, 5],
  ])
  expect(toGridRows([1, 2, 3, 4, 5, 6], 3)).toStrictEqual([
    [1, 2, 3],
    [4, 5, 6],
  ])
  expect(toGridRows([], 3)).toStrictEqual([])
})

test('nextCursor 在网格内移动, 边界处保持不动', () => {
  // total 5, columns 3 => 行: [0,1,2],[3,4]
  expect(nextCursor(0, 5, 'right', 3)).toBe(1)
  expect(nextCursor(2, 5, 'right', 3)).toBe(2) // 行末不再右移
  expect(nextCursor(4, 5, 'right', 3)).toBe(4) // 已是最后一个
  expect(nextCursor(4, 5, 'left', 3)).toBe(3)
  expect(nextCursor(3, 5, 'left', 3)).toBe(3) // 行首不再左移
  expect(nextCursor(0, 5, 'down', 3)).toBe(3)
  expect(nextCursor(3, 5, 'down', 3)).toBe(3) // 下方无条目
  expect(nextCursor(2, 5, 'down', 3)).toBe(2) // 下方无条目 (index 5 不存在)
  expect(nextCursor(4, 5, 'up', 3)).toBe(1)
  expect(nextCursor(1, 5, 'up', 3)).toBe(1) // 顶行不再上移
  expect(nextCursor(0, 0, 'down', 3)).toBe(0) // 空列表
})

test('nextCursor 的纵向步进跟随列数', () => {
  // total 6, columns 2 => 行: [0,1],[2,3],[4,5]
  expect(nextCursor(0, 6, 'down', 2)).toBe(2)
  expect(nextCursor(2, 6, 'up', 2)).toBe(0)
  expect(nextCursor(1, 6, 'right', 2)).toBe(1) // 行末不再右移
  expect(nextCursor(5, 6, 'down', 2)).toBe(5) // 下方无条目
})

test('scrollForCursor 使光标行保持在可视窗口内', () => {
  // 10 行, 可视 3 行, maxOffset = 7
  expect(scrollForCursor(0, 10, 5, 3, 3)).toBe(0) // 光标在顶, 窗口回到顶
  expect(scrollForCursor(27, 10, 0, 3, 3)).toBe(7) // index 27 => 行 9, 贴底
  expect(scrollForCursor(12, 10, 2, 3, 3)).toBe(2) // index 12 => 行 4, 已在 [2,5) 内
  expect(scrollForCursor(9, 10, 5, 3, 3)).toBe(3) // index 9 => 行 3, 上滚到 3
  expect(scrollForCursor(0, 2, 0, 3, 3)).toBe(0) // 行数不超过可视, 恒 0
})

test('scrollForCursor 按新列数重新定位光标行', () => {
  // 6 行 12 个条目: columns 6 时光标 11 在行 1, columns 2 时同一光标落到行 5
  expect(scrollForCursor(11, 6, 0, 3, 6)).toBe(0) // 行 1 已在 [0,3) 内
  expect(scrollForCursor(11, 6, 0, 3, 2)).toBe(3) // 行 5 => 上滚到 3
})

test('rowWindow 将窗口起点钳制在有效范围内', () => {
  expect(rowWindow(3, 10, 5)).toStrictEqual({ start: 0, end: 3 })
  expect(rowWindow(10, 99, 3)).toStrictEqual({ start: 7, end: 10 })
  expect(rowWindow(10, 4, 3)).toStrictEqual({ start: 4, end: 7 })
  expect(rowWindow(0, 0, 5)).toStrictEqual({ start: 0, end: 0 })
})

// 命令上实际使用的列间距
const GAP = 2

test('gridColumnCount 按内容区宽度放下尽可能多的最小单元格', () => {
  // 内容区宽度 = 终端宽度 - TABLE_CHROME, 每列占最小单元格宽度 24 再加列间距
  expect(gridColumnCount(80 - TABLE_CHROME, GAP)).toBe(3) // 内容区 76: 3 * 24 + 2 * 2 = 76, 刚好放下
  expect(gridColumnCount(79 - TABLE_CHROME, GAP)).toBe(2)
  expect(gridColumnCount(119 - TABLE_CHROME, GAP)).toBe(4) // 宽度守卫给出的最小终端宽度
  expect(gridColumnCount(140 - TABLE_CHROME, GAP)).toBe(5)
  expect(gridColumnCount(164 - TABLE_CHROME, GAP)).toBe(6)
})

test('gridColumnCount 把列间距计入每格宽度', () => {
  // 内容区 136: 间距 2 时 5 * 24 + 4 * 2 = 128 放得下, 间距 12 时 5 * 24 + 4 * 12 = 168 放不下
  expect(gridColumnCount(140 - TABLE_CHROME, 2)).toBe(5)
  expect(gridColumnCount(140 - TABLE_CHROME, 12)).toBe(4)
})

test('gridColumnCount 将列数钳制在上下限内', () => {
  expect(gridColumnCount(0 - TABLE_CHROME, GAP)).toBe(2) // 内容区宽度为负 (终端宽度未知)
  expect(gridColumnCount(40 - TABLE_CHROME, GAP)).toBe(2) // 内容区 36: 只能放 1 列, 由下限兜住
  expect(gridColumnCount(400 - TABLE_CHROME, GAP)).toBe(8) // 内容区 396: 远超上限
})
