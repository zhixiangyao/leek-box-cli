import { setTimeout as delay } from 'node:timers/promises'

import { Box } from 'ink'
import { expect, test } from 'vitest'

import CheckboxGrid from '../src/components/CheckboxGrid/index.tsx'
import {
  CaptureOutput,
  createInput,
  plain,
  renderInk,
  unmountApp,
  waitForLatestFrame,
  waitForState,
} from './helpers/ink.tsx'

type Item = { code: string; name: string }

const makeItems = (count: number): Item[] =>
  Array.from({ length: count }, (_unused, index) => ({
    code: `c${index.toString().padStart(2, '0')}`,
    name: `股票${index.toString().padStart(2, '0')}`,
  }))

const DOWN = '\u001B[B'
const RIGHT = '\u001B[C'

/** 首个条目所在行, 用于断言同一行里的列排布 */
const firstRow = (output: CaptureOutput) =>
  plain(output.frames.at(-1) ?? '')
    .split('\n')
    .find((line) => line.includes('股票00'))

type GridOptions = {
  height?: number
  columnCount?: number
  columnGap?: number
  defaultCursor?: number
  onCursorChange?: (cursor: number) => void
}

/** 默认按 90 列宽, 12 行高, 3 列 2 间距渲染, 用例按需覆盖 */
const renderGrid = (
  items: Item[],
  isActive: boolean,
  onSubmit: (selected: Item[]) => void,
  options: GridOptions = {},
) => {
  const { height = 12, columnCount = 3, columnGap = 2, defaultCursor, onCursorChange } = options
  const output = new CaptureOutput(90, height)
  const input = createInput()
  const instance = renderInk(
    <Box width={90} height={height} flexDirection="column">
      <CheckboxGrid
        items={items}
        getKey={(item) => item.code}
        getLabel={(item) => item.name}
        columnCount={columnCount}
        columnGap={columnGap}
        isActive={isActive}
        defaultCursor={defaultCursor}
        onCursorChange={onCursorChange}
        onSubmit={onSubmit}
      />
    </Box>,
    { output, input, interactive: true },
  )
  return { output, input, instance }
}

const press = async (input: ReturnType<typeof createInput>, sequence: string, times = 1) => {
  for (let count = 0; count < times; count += 1) {
    input.write(sequence)
    await delay(14)
  }
}

test('CheckboxGrid: 空格勾选, 右移再勾选, 回车提交勾选项', async () => {
  const items = makeItems(9)
  const submitted: Item[][] = []
  const { output, input, instance } = renderGrid(items, true, (selected) => submitted.push(selected))

  try {
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[ ] 股票00'))
    await press(input, ' ')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[x] 股票00'))
    await press(input, RIGHT)
    await press(input, ' ')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[x] 股票01'))
    await press(input, '\r')
    await waitForState(() => submitted.length === 1)
    expect(submitted[0]!.map((item) => item.code)).toStrictEqual(['c00', 'c01'])
  } finally {
    await unmountApp(instance)
  }
})

test('CheckboxGrid: vim 键 hjkl 与方向键等效, 边界处同样保持不动', async () => {
  const items = makeItems(9)
  const submitted: Item[][] = []
  const { output, input, instance } = renderGrid(items, true, (selected) => submitted.push(selected))

  try {
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[ ] 股票00'))
    await press(input, 'l') // 右移一列: 0 -> 1
    await press(input, 'j') // 下移一行 (3 列 => +3): 1 -> 4
    await press(input, ' ')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[x] 股票04'))
    await press(input, 'k') // 上移一行: 4 -> 1
    await press(input, 'h') // 左移一列: 1 -> 0
    await press(input, ' ')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[x] 股票00'))
    await press(input, 'h') // 行首不再左移
    await press(input, 'k') // 顶行不再上移
    await press(input, ' ') // 光标仍在 股票00: 取消勾选
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[ ] 股票00'))
    await press(input, '\r')
    await waitForState(() => submitted.length === 1)
    expect(submitted[0]!.map((item) => item.code)).toStrictEqual(['c04'])
  } finally {
    await unmountApp(instance)
  }
})

test('CheckboxGrid: 光标下移超出可视区域时向下滚动', async () => {
  const items = makeItems(45)
  const { output, input, instance } = renderGrid(items, true, () => undefined, { height: 8 })

  try {
    // 等待测量完成 (可视 8 行时第 8 行 股票21 出现)
    await waitForLatestFrame(output, (frame) => plain(frame).includes('股票21'))
    await press(input, DOWN, 20)
    await waitForLatestFrame(output, (frame) => plain(frame).includes('股票44') && !plain(frame).includes('股票00'))
    expect(plain(output.frames.at(-1) ?? '').includes('股票44')).toBe(true)
    expect(plain(output.frames.at(-1) ?? '').includes('股票00')).toBe(false)
  } finally {
    await unmountApp(instance)
  }
})

test('CheckboxGrid: columnCount 决定每行列数与光标纵向步进', async () => {
  const items = makeItems(6)
  const submitted: Item[][] = []
  const { output, input, instance } = renderGrid(items, true, (selected) => submitted.push(selected), {
    columnCount: 2,
  })

  try {
    await waitForState(() => firstRow(output) !== undefined)
    expect(firstRow(output)).toContain('股票01') // 两列: 同行放下第二个条目
    expect(firstRow(output)).not.toContain('股票02') // 第三项换行

    await press(input, DOWN) // columns 2 => 下移两格到 股票02
    await press(input, ' ')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[x] 股票02'))
    await press(input, '\r')
    await waitForState(() => submitted.length === 1)
    expect(submitted[0]!.map((item) => item.code)).toStrictEqual(['c02'])
  } finally {
    await unmountApp(instance)
  }
})

test('CheckboxGrid: columnGap 决定两列之间的距离', async () => {
  // 两列等分行宽, 第二列的起点随间距右移: 取同一行里两个条目的列差
  const columnOffset = async (columnGap: number) => {
    const { output, instance } = renderGrid(makeItems(4), true, () => undefined, { columnCount: 2, columnGap })
    try {
      await waitForState(() => firstRow(output) !== undefined)
      const line = firstRow(output) ?? ''
      return line.indexOf('股票01') - line.indexOf('股票00')
    } finally {
      await unmountApp(instance)
    }
  }

  expect(await columnOffset(20)).toBeGreaterThan(await columnOffset(2))
})

test('CheckboxGrid: isActive 为 false 时忽略输入', async () => {
  const items = makeItems(9)
  const submitted: Item[][] = []
  const { output, input, instance } = renderGrid(items, false, (selected) => submitted.push(selected))

  try {
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[ ] 股票00'))
    await press(input, ' ')
    await press(input, '\r')
    await delay(200)
    expect(plain(output.frames.at(-1) ?? '').includes('[x]')).toBe(false)
    expect(submitted).toStrictEqual([])
  } finally {
    await unmountApp(instance)
  }
})

test('CheckboxGrid: 未勾选时回车不触发提交', async () => {
  const items = makeItems(9)
  const submitted: Item[][] = []
  const { output, input, instance } = renderGrid(items, true, (selected) => submitted.push(selected))

  try {
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[ ] 股票00'))
    await press(input, RIGHT)
    await press(input, '\r')
    await delay(200)
    expect(submitted).toStrictEqual([])
  } finally {
    await unmountApp(instance)
  }
})

test('CheckboxGrid: 空格再次按下取消勾选', async () => {
  const items = makeItems(9)
  const submitted: Item[][] = []
  const { output, input, instance } = renderGrid(items, true, (selected) => submitted.push(selected))

  try {
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[ ] 股票00'))
    await press(input, ' ')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[x] 股票00'))
    await press(input, ' ')
    await waitForLatestFrame(output, (frame) => !plain(frame).includes('[x]'))
    await press(input, '\r')
    await delay(200)
    expect(submitted).toStrictEqual([])
  } finally {
    await unmountApp(instance)
  }
})

test('CheckboxGrid: 空列表渲染为空网格且回车不触发', async () => {
  const submitted: Item[][] = []
  const { output, input, instance } = renderGrid([], true, (selected) => submitted.push(selected))

  try {
    await delay(200)
    expect(plain(output.frames.at(-1) ?? '').includes('[ ]')).toBe(false)
    await press(input, ' ')
    await press(input, '\r')
    await delay(200)
    expect(submitted).toStrictEqual([])
  } finally {
    await unmountApp(instance)
  }
})

test('CheckboxGrid: defaultCursor 决定初始光标, onCursorChange 回传移动后的下标', async () => {
  const cursors: number[] = []
  const { output, input, instance } = renderGrid(makeItems(9), true, () => undefined, {
    defaultCursor: 4,
    onCursorChange: (cursor) => cursors.push(cursor),
  })

  try {
    // 初始就停在下标 4: 空格勾的是 股票04
    await press(input, ' ')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[x] 股票04'))

    await press(input, RIGHT) // 4 -> 5
    await press(input, ' ')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[x] 股票05'))
    // 初始位置不回传, 只有移动才回传
    expect(cursors).toStrictEqual([5])
  } finally {
    await unmountApp(instance)
  }
})

test('CheckboxGrid: defaultCursor 越界时钳制到末格', async () => {
  const cursors: number[] = []
  const { output, input, instance } = renderGrid(makeItems(9), true, () => undefined, {
    defaultCursor: 99,
    onCursorChange: (cursor) => cursors.push(cursor),
  })

  try {
    await press(input, ' ')
    await waitForLatestFrame(output, (frame) => plain(frame).includes('[x] 股票08'))
    expect(cursors).toStrictEqual([])
  } finally {
    await unmountApp(instance)
  }
})
