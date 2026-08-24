import { PassThrough, Writable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'

import { createElement, type ComponentProps, type ComponentType } from 'react'
import { expect, test } from 'vitest'

process.env['FORCE_COLOR'] = '1'

const [{ render, Text: InkText }, { default: App }, { default: Card }, { MIN_TERMINAL_ROWS }, { stockTableWidth }] =
  await Promise.all([
    import('ink'),
    import('../src/app.tsx'),
    import('../src/components/Card.tsx'),
    import('../src/lib/layout.ts'),
    import('../src/lib/stockTable.ts'),
  ])

const [
  { useAddStockStore },
  { useMenuStore },
  { useRemoveStockStore },
  { useRouterStore },
  { useStockDetailStore },
  { useStockListStore },
] = await Promise.all([
  import('../src/stores/useAddStockStore.ts'),
  import('../src/stores/useMenuStore.ts'),
  import('../src/stores/useRemoveStockStore.ts'),
  import('../src/stores/useRouterStore.ts'),
  import('../src/stores/useStockDetailStore.ts'),
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
  useAddStockStore.setState(useAddStockStore.getInitialState(), true)
  useMenuStore.setState(useMenuStore.getInitialState(), true)
  useRemoveStockStore.setState(useRemoveStockStore.getInitialState(), true)
  useRouterStore.setState(useRouterStore.getInitialState(), true)
  useStockDetailStore.setState(useStockDetailStore.getInitialState(), true)
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
  const columns = stockTableWidth() + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({
        step: { type: 'table', rows: [], updatedAt: '15:00' },
        pollIntervalMs: 5000,
      })
    },
  })
  useRemoveStockStore.setState({
    loadEntries: async () => {
      useRemoveStockStore.setState({ step: { type: 'error', message: '测试自选股为空' } })
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
      return text.includes('股票自选股看板') && text.includes('15:00 (5000ms)')
    })
    expect(plain(stockFrame)).toMatch(/刷新\(r\)/)
    assertFrameSize(stockFrame, columns, rows)

    let after = output.frames.length
    useRouterStore.setState({ screen: 'add-stock' })
    const addFrame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('添加自选股'))
    expect(plain(addFrame)).not.toMatch(/15:00 \(5000ms\)/)
    expect(plain(addFrame)).toMatch(/请输入股票代码/)
    assertFrameSize(addFrame, columns, rows)

    after = output.frames.length
    useRouterStore.setState({ screen: 'remove-stock' })
    const removeFrame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('删除自选股'))
    expect(plain(removeFrame)).not.toMatch(/15:00 \(5000ms\)/)
    expect(plain(removeFrame)).toMatch(/测试自选股为空/)
    assertFrameSize(removeFrame, columns, rows)

    after = output.frames.length
    useRouterStore.setState({ screen: 'add-stock' })
    const brightFrame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('添加自选股'))
    expect(brightFrame).not.toContain('\u001B[2m')

    after = output.frames.length
    useMenuStore.setState({ open: true })
    const dimmedFrame = await waitForFrame(output, after, (candidate) => {
      const text = plain(candidate)
      return text.includes('添加自选股') && text.includes('股票自选股看板') && candidate.includes('\u001B[2m')
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
