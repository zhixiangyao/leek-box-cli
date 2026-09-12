import { PassThrough, Writable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'

import { createElement, type ComponentProps, type ComponentType } from 'react'
import { expect, test, vi } from 'vitest'

process.env['FORCE_COLOR'] = '1'

const [
  { render, Text: InkText },
  { default: App },
  { default: Card },
  { MIN_TERMINAL_COLUMNS, MIN_TERMINAL_ROWS, TABLE_CHROME },
  { stockListColumns, tableWidth },
] = await Promise.all([
  import('ink'),
  import('../src/app.tsx'),
  import('../src/components/Card.tsx'),
  import('../src/components/WindowSizeGuard.tsx'),
  import('../src/lib/quoteTable.ts'),
])

const STOCK_LIST_COLUMNS = stockListColumns()

const [
  { useStockAddStore },
  { useStockRemoveStore },
  { useDialogMenuStore },
  { useDialogRemoveConfirmStore },
  { useDialogConfirmStore },
  { useRouterStore },
  { useSettingsStore },
  { useDialogStockDetailStore },
  { useStockListStore },
  { setActiveLocale },
  { DEFAULT_LOCALE, LOCALES },
] = await Promise.all([
  import('../src/stores/useStockAddStore.ts'),
  import('../src/stores/useStockRemoveStore.ts'),
  import('../src/stores/useDialogMenuStore.ts'),
  import('../src/stores/useDialogRemoveConfirmStore.ts'),
  import('../src/stores/useDialogConfirmStore.ts'),
  import('../src/stores/useRouterStore.ts'),
  import('../src/stores/useSettingsStore.ts'),
  import('../src/stores/useDialogStockDetailStore.ts'),
  import('../src/stores/useStockListStore.ts'),
  import('../src/i18n/core.ts'),
  import('../src/i18n/locale.ts'),
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

/**
 * 语言固定为简体中文: 默认值 auto 会跟随运行环境的系统语言,
 * 断言渲染帧的测试必须与机器语言无关.
 */
const resetStores = () => {
  useStockAddStore.setState(useStockAddStore.getInitialState(), true)
  useDialogMenuStore.setState(useDialogMenuStore.getInitialState(), true)
  useDialogConfirmStore.setState(useDialogConfirmStore.getInitialState(), true)
  useDialogRemoveConfirmStore.setState(useDialogRemoveConfirmStore.getInitialState(), true)
  useRouterStore.setState(useRouterStore.getInitialState(), true)
  useSettingsStore.setState({ ...useSettingsStore.getInitialState(), language: DEFAULT_LOCALE }, true)
  useDialogStockDetailStore.setState(useDialogStockDetailStore.getInitialState(), true)
  useStockListStore.setState(useStockListStore.getInitialState(), true)
  setActiveLocale(DEFAULT_LOCALE)
}

/**
 * 宽度下限必须与界面语言无关: 若按当前 locale 推导, 在恰好满足中文下限的终端上
 * 切到英文就会被守卫拦住, 而设置页也在守卫之内, 语言再也改不回来.
 */
test('终端宽度下限覆盖全部语言的看板占宽', () => {
  for (const locale of LOCALES) {
    expect(tableWidth(stockListColumns(locale)) + TABLE_CHROME, locale).toBeLessThanOrEqual(MIN_TERMINAL_COLUMNS)
  }
})

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

test('删除确认弹窗按阶段处理按键: confirm 只接受 n/y, done/error 接受 esc', async () => {
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

    // confirm 阶段只接受 hint 里的 n/y: esc 被忽略, 弹窗保持
    dialogStore.getState().open(targets)
    after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))
    const token = useStockRemoveStore.getState().resetToken
    input.write('\x1B')
    await delay(100)
    expect(dialogStore.getState().step.type).toBe('confirm')
    // n 取消: 弹窗关闭, 网格勾选保留 (resetToken 不变)
    input.write('n')
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

test('通用确认弹窗: 错误态 hint 切换为 关闭(esc) 重试(y), n 忽略, esc 关闭, y 重试', async () => {
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
    const confirm = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    let after = output.frames.length
    useDialogConfirmStore.setState({
      config: { title: '确认重置吗?', content: '此操作将重置所有设置与自选股为默认值.', isError: false, confirm },
    })
    await waitForFrame(
      output,
      after,
      (candidate) => plain(candidate).includes('确认重置吗') && plain(candidate).includes('取消(n)'),
    )

    // update 把错误同步进弹窗: 内容为失败信息, hint 切换为 关闭(esc) 重试(y)
    after = output.frames.length
    useDialogConfirmStore.getState().update({ content: '重置失败: 锁超时', isError: true })
    await waitForFrame(
      output,
      after,
      (candidate) =>
        plain(candidate).includes('重置失败: 锁超时') &&
        plain(candidate).includes('关闭(esc)') &&
        plain(candidate).includes('重试(y)'),
    )

    // 错误态 n 被忽略 (hint 未展示 n)
    input.write('n')
    await delay(100)
    expect(useDialogConfirmStore.getState().config?.isError).toBe(true)
    expect(useDialogConfirmStore.getState().config?.content).toBe('重置失败: 锁超时')

    // 错误态 esc 关闭
    input.write('\x1B')
    after = output.frames.length
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('确认重置吗'))
    expect(useDialogConfirmStore.getState().config).toBeUndefined()

    // 错误态 y 重试, 成功后才关闭
    confirm.mockClear()
    after = output.frames.length
    useDialogConfirmStore.setState({
      config: { title: '确认重置吗?', content: '重置失败: 锁超时', isError: true, confirm },
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('重试(y)'))
    input.write('y')
    after = output.frames.length
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('确认重置吗'))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(useDialogConfirmStore.getState().config).toBeUndefined()

    // 错误态 y 重试失败: reject 不外泄, 弹窗保留可继续重试
    confirm.mockClear()
    confirm.mockRejectedValueOnce(new Error('锁超时'))
    after = output.frames.length
    useDialogConfirmStore.setState({
      config: { title: '确认重置吗?', content: '重置失败: 锁超时', isError: true, confirm },
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('重试(y)'))
    input.write('y')
    await delay(100)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(useDialogConfirmStore.getState().config).not.toBeUndefined()
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

test('App 在 en 下渲染英文页面标题, 表头与本地化单位', async () => {
  const columns = tableWidth(stockListColumns('en')) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useSettingsStore.setState({ language: 'en' })
  setActiveLocale('en')
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({
        step: {
          type: 'table',
          rows: [
            {
              kind: 'quote',
              code: 'sh600000',
              name: '浦发银行',
              quote: {
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
                volume: 611_000,
                turnover: 55_000,
                turnoverRate: 1.2,
                amplitude: 3.5,
                marketCap: 2987.53,
                volumeRatio: 1.1,
              },
            },
            { kind: 'missing', code: 'sz000001', name: '平安银行' },
          ],
        },
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
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('Market Cap'))
    const text = plain(frame)

    // 页面标题与表头
    expect(text).toContain('Watchlist')
    expect(text).toContain('Change %')
    expect(text).toContain('Turnover %')
    // 本地化单位 (ScrollBox 只渲染测量到的窗口, 首行即行情行)
    expect(text).toContain('611.0K lots')
    expect(text).toContain('550.0M')
    expect(text).toContain('298.75B')
    // 中文单位不再出现
    expect(text).not.toContain('亿')
    expect(text).not.toContain('万手')
    assertFrameSize(frame, columns, rows)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})
