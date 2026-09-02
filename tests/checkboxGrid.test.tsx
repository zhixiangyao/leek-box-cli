import { PassThrough, Writable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'

import { Box, render } from 'ink'
import { expect, test } from 'vitest'

import CheckboxGrid from '../src/components/CheckboxGrid/index.tsx'
import { nextCursor, rowWindow, scrollForCursor, toGridRows } from '../src/components/CheckboxGrid/lib.ts'

process.env['FORCE_COLOR'] = '1'

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
  expect(nextCursor(0, 5, 'right')).toBe(1)
  expect(nextCursor(2, 5, 'right')).toBe(2) // 行末不再右移
  expect(nextCursor(4, 5, 'right')).toBe(4) // 已是最后一个
  expect(nextCursor(4, 5, 'left')).toBe(3)
  expect(nextCursor(3, 5, 'left')).toBe(3) // 行首不再左移
  expect(nextCursor(0, 5, 'down')).toBe(3)
  expect(nextCursor(3, 5, 'down')).toBe(3) // 下方无条目
  expect(nextCursor(2, 5, 'down')).toBe(2) // 下方无条目 (index 5 不存在)
  expect(nextCursor(4, 5, 'up')).toBe(1)
  expect(nextCursor(1, 5, 'up')).toBe(1) // 顶行不再上移
  expect(nextCursor(0, 0, 'down')).toBe(0) // 空列表
})

test('scrollForCursor 使光标行保持在可视窗口内', () => {
  // 10 行, 可视 3 行, maxOffset = 7
  expect(scrollForCursor(0, 10, 5, 3)).toBe(0) // 光标在顶, 窗口回到顶
  expect(scrollForCursor(27, 10, 0, 3)).toBe(7) // index 27 => 行 9, 贴底
  expect(scrollForCursor(12, 10, 2, 3)).toBe(2) // index 12 => 行 4, 已在 [2,5) 内
  expect(scrollForCursor(9, 10, 5, 3)).toBe(3) // index 9 => 行 3, 上滚到 3
  expect(scrollForCursor(0, 2, 0, 3)).toBe(0) // 行数不超过可视, 恒 0
})

test('rowWindow 将窗口起点钳制在有效范围内', () => {
  expect(rowWindow(3, 10, 5)).toStrictEqual({ start: 0, end: 3 })
  expect(rowWindow(10, 99, 3)).toStrictEqual({ start: 7, end: 10 })
  expect(rowWindow(10, 4, 3)).toStrictEqual({ start: 4, end: 7 })
  expect(rowWindow(0, 0, 5)).toStrictEqual({ start: 0, end: 0 })
})

type Item = { code: string; name: string }

const makeItems = (count: number): Item[] =>
  Array.from({ length: count }, (_unused, index) => ({
    code: `c${index.toString().padStart(2, '0')}`,
    name: `股票${index.toString().padStart(2, '0')}`,
  }))

class CaptureOutput extends Writable {
  readonly columns: number
  readonly rows: number
  readonly isTTY = true
  readonly frames: string[] = []
  constructor(columns: number, rows: number) {
    super()
    this.columns = columns
    this.rows = rows
  }
  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.frames.push(chunk.toString())
    callback()
  }
}

const createInput = () => {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean
    setRawMode: (mode: boolean) => PassThrough
    ref: () => PassThrough
    unref: () => PassThrough
  }
  input.isTTY = true
  input.setRawMode = () => input
  input.ref = () => input
  input.unref = () => input
  return input
}

const DOWN = '\u001B[B'
const RIGHT = '\u001B[C'

const latest = (output: CaptureOutput) => stripVTControlCharacters(output.frames.at(-1) ?? '')

const waitFor = async (check: () => boolean) => {
  const deadline = Date.now() + 2000
  while (Date.now() < deadline) {
    if (check()) return
    await delay(10)
  }
  throw new Error('timed out waiting for expected frame or state')
}

const renderGrid = (items: Item[], isActive: boolean, onSubmit: (selected: Item[]) => void, height = 12) => {
  const output = new CaptureOutput(90, height)
  const input = createInput()
  const instance = render(
    <Box width={90} height={height} flexDirection="column">
      <CheckboxGrid
        items={items}
        getKey={(item) => item.code}
        getLabel={(item) => item.name}
        isActive={isActive}
        onSubmit={onSubmit}
      />
    </Box>,
    {
      stdout: output as unknown as NodeJS.WriteStream,
      stdin: input as unknown as NodeJS.ReadStream,
      stderr: new PassThrough() as unknown as NodeJS.WriteStream,
      debug: true,
      interactive: true,
      patchConsole: false,
    },
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
    await waitFor(() => latest(output).includes('[ ] 股票00'))
    await press(input, ' ')
    await waitFor(() => latest(output).includes('[x] 股票00'))
    await press(input, RIGHT)
    await press(input, ' ')
    await waitFor(() => latest(output).includes('[x] 股票01'))
    await press(input, '\r')
    await waitFor(() => submitted.length === 1)
    expect(submitted[0]!.map((item) => item.code)).toStrictEqual(['c00', 'c01'])
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('CheckboxGrid: 光标下移超出可视区域时向下滚动', async () => {
  const items = makeItems(45)
  const { output, input, instance } = renderGrid(items, true, () => undefined, 8)

  try {
    // 等待测量完成 (可视 8 行时第 8 行 股票21 出现)
    await waitFor(() => latest(output).includes('股票21'))
    await press(input, DOWN, 20)
    await waitFor(() => latest(output).includes('股票44') && !latest(output).includes('股票00'))
    expect(latest(output).includes('股票44')).toBe(true)
    expect(latest(output).includes('股票00')).toBe(false)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('CheckboxGrid: isActive 为 false 时忽略输入', async () => {
  const items = makeItems(9)
  const submitted: Item[][] = []
  const { output, input, instance } = renderGrid(items, false, (selected) => submitted.push(selected))

  try {
    await waitFor(() => latest(output).includes('[ ] 股票00'))
    await press(input, ' ')
    await press(input, '\r')
    await delay(200)
    expect(latest(output).includes('[x]')).toBe(false)
    expect(submitted).toStrictEqual([])
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('CheckboxGrid: 未勾选时回车不触发提交', async () => {
  const items = makeItems(9)
  const submitted: Item[][] = []
  const { output, input, instance } = renderGrid(items, true, (selected) => submitted.push(selected))

  try {
    await waitFor(() => latest(output).includes('[ ] 股票00'))
    await press(input, RIGHT)
    await press(input, '\r')
    await delay(200)
    expect(submitted).toStrictEqual([])
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('CheckboxGrid: 空格再次按下取消勾选', async () => {
  const items = makeItems(9)
  const submitted: Item[][] = []
  const { output, input, instance } = renderGrid(items, true, (selected) => submitted.push(selected))

  try {
    await waitFor(() => latest(output).includes('[ ] 股票00'))
    await press(input, ' ')
    await waitFor(() => latest(output).includes('[x] 股票00'))
    await press(input, ' ')
    await waitFor(() => !latest(output).includes('[x]'))
    await press(input, '\r')
    await delay(200)
    expect(submitted).toStrictEqual([])
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('CheckboxGrid: 空列表渲染为空网格且回车不触发', async () => {
  const submitted: Item[][] = []
  const { output, input, instance } = renderGrid([], true, (selected) => submitted.push(selected))

  try {
    await delay(200)
    expect(latest(output).includes('[ ]')).toBe(false)
    await press(input, ' ')
    await press(input, '\r')
    await delay(200)
    expect(submitted).toStrictEqual([])
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})
