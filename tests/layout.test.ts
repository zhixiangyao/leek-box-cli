import { PassThrough, Writable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'

import { createElement, type ComponentProps, type ComponentType } from 'react'
import { expect, test } from 'vitest'

process.env['FORCE_COLOR'] = '1'

const [
  { render, Text: InkText },
  { default: App },
  { default: Card },
  { MIN_TERMINAL_ROWS },
  { STOCK_LIST_COLUMNS, tableWidth },
] = await Promise.all([
  import('ink'),
  import('../src/app.tsx'),
  import('../src/components/Card.tsx'),
  import('../src/components/WindowSizeGuard.tsx'),
  import('../src/lib/quoteTable.ts'),
])

const [
  { useStockAddStore },
  { useStockRemoveStore },
  { useDialogMenuStore },
  { useDialogRemoveConfirmStore },
  { useRouterStore },
  { useSettingsStore },
  { useDialogStockDetailStore },
  { useStockListStore },
] = await Promise.all([
  import('../src/stores/useStockAddStore.ts'),
  import('../src/stores/useStockRemoveStore.ts'),
  import('../src/stores/useDialogMenuStore.ts'),
  import('../src/stores/useDialogRemoveConfirmStore.ts'),
  import('../src/stores/useRouterStore.ts'),
  import('../src/stores/useSettingsStore.ts'),
  import('../src/stores/useDialogStockDetailStore.ts'),
  import('../src/stores/useStockListStore.ts'),
])

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

const TestCard = Card as ComponentType<Omit<ComponentProps<typeof Card>, 'children'>>

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

const plain = (frame: string) => stripVTControlCharacters(frame)

const waitForFrame = async (
  output: CaptureOutput,
  after: number,
  predicate: (frame: string) => boolean,
): Promise<string> => {
  const deadline = Date.now() + 2000
  while (Date.now() < deadline) {
    const frame = output.frames.slice(after).findLast(predicate)
    if (frame !== undefined) return frame
    await delay(10)
  }

  throw new Error(`Timed out waiting for frame. Latest output:\n${plain(output.frames.at(-1) ?? '')}`)
}

const assertFrameSize = (frame: string, columns: number, rows: number) => {
  const lines = plain(frame).split('\n')
  expect(lines).toHaveLength(rows)
  expect(lines.at(-1)?.length).toBe(columns)
}

const resetStores = () => {
  useStockAddStore.setState(useStockAddStore.getInitialState(), true)
  useDialogMenuStore.setState(useDialogMenuStore.getInitialState(), true)
  useDialogRemoveConfirmStore.setState(useDialogRemoveConfirmStore.getInitialState(), true)
  useRouterStore.setState(useRouterStore.getInitialState(), true)
  useSettingsStore.setState(useSettingsStore.getInitialState(), true)
  useDialogStockDetailStore.setState(useDialogStockDetailStore.getInitialState(), true)
  useStockListStore.setState(useStockListStore.getInitialState(), true)
}

test('Card fullScreen 使用终端尺寸而非显式尺寸', async () => {
  const columns = 41
  const rows = 9
  const output = new CaptureOutput(columns, rows)
  const instance = render(
    createElement(
      TestCard,
      {
        fullScreen: true,
        width: 7,
        height: 3,
      },
      createElement(InkText, null, 'content'),
    ),
    {
      stdout: output as unknown as NodeJS.WriteStream,
      stdin: createInput() as unknown as NodeJS.ReadStream,
      stderr: new PassThrough() as unknown as NodeJS.WriteStream,
      debug: true,
      interactive: false,
      patchConsole: false,
    },
  )

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('content'))
    assertFrameSize(frame, columns, rows)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('App 在路由切换和菜单 overlay 期间保持 Screen 自有的全屏 chrome 正确', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({
        step: { type: 'table', rows: [] },
      })
    },
  })
  useStockRemoveStore.setState({
    loadEntries: async () => {
      useStockRemoveStore.setState({
        entries: [{ code: 'sh600000', name: '删除测试股', addedAt: '2026-08-20T00:00:00.000Z' }],
      })
    },
  })

  const instance = render(createElement(App), {
    stdout: output as unknown as NodeJS.WriteStream,
    stdin: createInput() as unknown as NodeJS.ReadStream,
    stderr: new PassThrough() as unknown as NodeJS.WriteStream,
    debug: true,
    interactive: false,
    patchConsole: false,
  })

  try {
    const stockFrame = await waitForFrame(output, 0, (candidate) => {
      const text = plain(candidate)
      return text.includes('自选股票看板') && text.includes('名称') && text.includes('代码')
    })
    expect(plain(stockFrame)).toMatch(/刷新\(r\)/)
    expect(plain(stockFrame)).not.toMatch(/间隔\(-\/\+\)/)
    expect(plain(stockFrame).indexOf('名称')).toBeLessThan(plain(stockFrame).indexOf('代码'))
    assertFrameSize(stockFrame, columns, rows)

    let after = output.frames.length
    useRouterStore.setState({ screen: 'stock-add' })
    const addFrame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('添加自选股'))
    expect(plain(addFrame)).not.toMatch(/15:00 \(5000ms\)/)
    expect(plain(addFrame)).toMatch(/请输入股票代码/)
    assertFrameSize(addFrame, columns, rows)

    after = output.frames.length
    useRouterStore.setState({ screen: 'stock-remove' })
    const removeFrame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('删除自选股'))
    expect(plain(removeFrame)).not.toMatch(/15:00 \(5000ms\)/)
    expect(plain(removeFrame)).toMatch(/删除测试股/)
    assertFrameSize(removeFrame, columns, rows)

    after = output.frames.length
    useRouterStore.setState({ screen: 'stock-add' })
    const brightFrame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('添加自选股'))
    expect(brightFrame).not.toContain('\u001B[2m')

    after = output.frames.length
    useDialogMenuStore.setState({ open: true })
    const dimmedFrame = await waitForFrame(output, after, (candidate) => {
      const text = plain(candidate)
      return text.includes('添加自选股') && text.includes('自选股票看板') && candidate.includes('\u001B[2m')
    })
    expect(plain(dimmedFrame)).toMatch(/菜单/)
    assertFrameSize(dimmedFrame, columns, rows)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的 esc 优先级接线: 删除确认弹窗按阶段处理 esc', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockRemoveStore.setState({
    loadEntries: async () => {
      useStockRemoveStore.setState({
        entries: [
          { code: 'sh600000', name: '浦发银行', addedAt: '2026-08-20T00:00:00.000Z' },
          { code: 'sz000001', name: '平安银行', addedAt: '2026-08-20T00:00:00.000Z' },
        ],
      })
    },
  })

  const instance = render(createElement(App), {
    stdout: output as unknown as NodeJS.WriteStream,
    stdin: input as unknown as NodeJS.ReadStream,
    stderr: new PassThrough() as unknown as NodeJS.WriteStream,
    debug: true,
    interactive: false,
    patchConsole: false,
  })

  try {
    let after = output.frames.length
    useRouterStore.setState({ screen: 'stock-remove' })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('删除自选股'))
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('浦发银行'))

    const dialogStore = useDialogRemoveConfirmStore
    const targets = [
      { code: 'sh600000', name: '浦发银行', addedAt: '2026-08-20T00:00:00.000Z' },
      { code: 'sz000001', name: '平安银行', addedAt: '2026-08-20T00:00:00.000Z' },
    ]

    // confirm 阶段 esc 取消: 弹窗关闭, 网格勾选保留 (resetToken 不变)
    dialogStore.getState().open(targets)
    after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))
    const token = useStockRemoveStore.getState().resetToken
    input.write('\x1B')
    after = output.frames.length
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('确定删除选中的'))
    expect(dialogStore.getState().step).toStrictEqual({ type: 'idle' })
    expect(useStockRemoveStore.getState().resetToken).toBe(token)

    // removing 阶段 esc 被忽略
    dialogStore.setState({ step: { type: 'removing' }, targets })
    after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('正在删除'))
    input.write('\x1B')
    await delay(100)
    expect(dialogStore.getState().step.type).toBe('removing')

    // error 阶段 esc 关闭
    dialogStore.setState({ step: { type: 'error', message: '删除失败: 锁超时' }, targets })
    after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('删除失败'))
    input.write('\x1B')
    after = output.frames.length
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('删除失败'))
    expect(dialogStore.getState().step).toStrictEqual({ type: 'idle' })

    // done 阶段 esc 关闭
    dialogStore.setState({ step: { type: 'done', message: '已删除 1 个股票, 1 个条目已不在自选股中.' }, targets: [] })
    after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('删除完成'))
    input.write('\x1B')
    after = output.frames.length
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('删除完成'))
    expect(dialogStore.getState().step).toStrictEqual({ type: 'idle' })
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的 esc 接线: 菜单开关切换', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({
        step: { type: 'table', rows: [] },
      })
    },
  })

  const instance = render(createElement(App), {
    stdout: output as unknown as NodeJS.WriteStream,
    stdin: input as unknown as NodeJS.ReadStream,
    stderr: new PassThrough() as unknown as NodeJS.WriteStream,
    debug: true,
    interactive: false,
    patchConsole: false,
  })

  try {
    let after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('自选股票看板'))

    // esc 打开菜单: 背景变暗
    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => candidate.includes('\x1B[2m'))
    expect(useDialogMenuStore.getState().open).toBe(true)

    // esc 再次按下关闭菜单: 背景恢复
    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => !candidate.includes('\x1B[2m'))
    expect(useDialogMenuStore.getState().open).toBe(false)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})
