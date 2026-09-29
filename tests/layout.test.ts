import { PassThrough, Writable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'

import { createElement, type ComponentProps, type ComponentType } from 'react'
import stringWidth from 'string-width'
import { expect, test, vi } from 'vitest'

import type { Quote } from '../src/api/types.ts'

process.env['FORCE_COLOR'] = '1'

const [
  { render, Box: InkBox, Text: InkText },
  { default: App },
  { default: Card },
  { LOGO_LINES },
  { MIN_TERMINAL_COLUMNS, MIN_TERMINAL_ROWS, TABLE_CHROME },
  { stockListColumns, tableWidth },
] = await Promise.all([
  import('ink'),
  import('../src/app.tsx'),
  import('../src/components/Card.tsx'),
  import('../src/components/AppLogo.tsx'),
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
  { useCommandStore },
  { useSettingsStore },
  { useDialogStockDetailStore },
  { useStockListStore },
  { setActiveLocale, t },
  { DEFAULT_LOCALE, LOCALES },
  { MENU_ITEMS },
] = await Promise.all([
  import('../src/stores/useStockAddStore.ts'),
  import('../src/stores/useStockRemoveStore.ts'),
  import('../src/stores/useDialogMenuStore.ts'),
  import('../src/stores/useDialogRemoveConfirmStore.ts'),
  import('../src/stores/useDialogConfirmStore.ts'),
  import('../src/stores/useCommandStore.ts'),
  import('../src/stores/useSettingsStore.ts'),
  import('../src/stores/useDialogStockDetailStore.ts'),
  import('../src/stores/useStockListStore.ts'),
  import('../src/i18n/core.ts'),
  import('../src/i18n/locale.ts'),
  import('../src/navigation/menu.ts'),
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

/**
 * 把 App 渲染到固定尺寸的输出: 除 debug 外的默认行为一律关掉, 用例只需断言帧.
 * 默认新开一条 stdin, 需要注入按键的用例自己传进来.
 */
const renderApp = (output: CaptureOutput, input: PassThrough = createInput()) =>
  render(createElement(App), {
    stdout: output as unknown as NodeJS.WriteStream,
    stdin: input as unknown as NodeJS.ReadStream,
    stderr: new PassThrough() as unknown as NodeJS.WriteStream,
    debug: true,
    interactive: false,
    patchConsole: false,
  })

const plain = (frame: string) => stripVTControlCharacters(frame)

/** SGR 参数里含 7 即反显: 只看参数本身, 避免把 27 (关闭反显) 也算进来 */
const isInverseLine = (line: string) =>
  line
    .split('\x1B[')
    .slice(1)
    .some((sequence) => sequence.slice(0, sequence.indexOf('m')).split(';').includes('7'))

const inverseLines = (frame: string) => frame.split('\n').filter(isInverseLine)

/** 选中行整行反显, 从帧里取那一行的代码 (选中行是 hook 的状态, store 里没有) */
const selectedCodeIn = (frame: string): string | undefined =>
  inverseLines(frame)
    .map((line) => line.match(/sh\d{6}|sz\d{6}/)?.[0])
    .find((code) => code !== undefined)

/** 行情字面量: 只列用例关心的字段, 其余取固定值 (单位用例断言的就是下面这几个数) */
const testQuote = (overrides: Partial<Quote> = {}): Quote => ({
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
  ...overrides,
})

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

/** 按键只改变 store 状态而没有可断言的帧差异时, 轮询状态直到按键生效 */
const waitForState = async (check: () => boolean) => {
  const deadline = Date.now() + 2000
  while (Date.now() < deadline) {
    if (check()) return
    await delay(10)
  }

  throw new Error('Timed out waiting for state')
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
  useStockRemoveStore.setState(useStockRemoveStore.getInitialState(), true)
  useDialogMenuStore.setState(useDialogMenuStore.getInitialState(), true)
  useDialogConfirmStore.setState(useDialogConfirmStore.getInitialState(), true)
  useDialogRemoveConfirmStore.setState(useDialogRemoveConfirmStore.getInitialState(), true)
  useCommandStore.setState(useCommandStore.getInitialState(), true)
  useSettingsStore.setState({ ...useSettingsStore.getInitialState(), language: DEFAULT_LOCALE }, true)
  useDialogStockDetailStore.setState(useDialogStockDetailStore.getInitialState(), true)
  useStockListStore.setState(useStockListStore.getInitialState(), true)
  setActiveLocale(DEFAULT_LOCALE)
}

/**
 * 宽度下限必须与界面语言无关: 若按当前 locale 推导, 在恰好满足中文下限的终端上
 * 切到英文就会被守卫拦住, 而设置命令也在守卫之内, 语言再也改不回来.
 */
test('终端宽度下限覆盖全部语言的看板占宽', () => {
  for (const locale of LOCALES) {
    expect(tableWidth(stockListColumns(locale)) + TABLE_CHROME, locale).toBeLessThanOrEqual(MIN_TERMINAL_COLUMNS)
  }
})

/**
 * art 是手写 ASCII, 居中靠父级 alignItems: 某行多一列就会错位半个差值, 且不会有任何报错.
 * 宽度上限与终端宽度下限绑定: 卡着下限的终端上, 超宽 art 会被裁掉.
 */
test('Logo art 各行等宽且不超过终端宽度下限', () => {
  const widths = LOGO_LINES.map((line) => stringWidth(line))
  expect(new Set(widths).size).toBe(1)
  expect(Math.max(...widths)).toBeLessThanOrEqual(MIN_TERMINAL_COLUMNS)
})

/** full 是 100% x 100%, 必须有一个给定尺寸的祖先 (应用里由 WindowSizeGuard 提供) */
test('Card full 占满给定尺寸的父盒而非显式尺寸', async () => {
  const columns = 41
  const rows = 9
  const output = new CaptureOutput(columns, rows)
  const instance = render(
    createElement(
      InkBox,
      { width: columns, height: rows },
      createElement(
        TestCard,
        {
          full: true,
          width: 7,
          height: 3,
        },
        createElement(InkText, null, 'content'),
      ),
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

test('App 的看板命令渲染自己的标题, hint 与列顺序', async () => {
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

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => {
      const text = plain(candidate)
      return text.includes('自选股票看板') && text.includes('名称') && text.includes('代码')
    })
    expect(plain(frame)).toContain(t('command.stockList.hint'))
    // hint 与监听同步: 看板只接受上下, 状态栏就不列左右
    expect(plain(frame)).not.toMatch(/间隔\(-\/\+\)/)
    expect(plain(frame).indexOf('名称')).toBeLessThan(plain(frame).indexOf('代码'))
    assertFrameSize(frame, columns, rows)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的看板排序键 s: 按涨跌幅排序并在右上角显示方向', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    // 轮询不动行情, 用例只关心排序键对已有行的作用
    refreshQuotes: async () => {},
    step: {
      type: 'table',
      rows: [
        { kind: 'missing', code: 'sz000001' },
        {
          kind: 'quote',
          code: 'sh600000',
          quote: testQuote(),
        },
      ],
    },
  })

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('sh600000'))
    // 默认按文件顺序: 缺失行在前, 右上角不显示排序方向
    expect(plain(frame)).not.toContain(t('stockList.sort.desc'))
    expect(plain(frame).indexOf('sz000001')).toBeLessThan(plain(frame).indexOf('sh600000'))

    input.write('s')
    const descFrame = await waitForFrame(output, after, (candidate) =>
      plain(candidate).includes(t('stockList.sort.desc')),
    )
    // 降序后行情行在前, 缺失行落到末尾
    expect(plain(descFrame).indexOf('sh600000')).toBeLessThan(plain(descFrame).indexOf('sz000001'))
    assertFrameSize(descFrame, columns, rows)

    input.write('s')
    const ascFrame = await waitForFrame(output, after, (candidate) =>
      plain(candidate).includes(t('stockList.sort.asc')),
    )
    expect(plain(ascFrame)).not.toContain(t('stockList.sort.desc'))
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的看板排序后右上角同时显示排序方向与剩余条数', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {},
    // 行数多于可视窗口才有剩余条数可显示
    step: {
      type: 'table',
      rows: Array.from({ length: 40 }, (_, index) => ({
        kind: 'missing',
        code: `sh6000${String(index).padStart(2, '0')}`,
      })),
    },
  })

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('sh600000'))
    const beforeCorner = plain(frame)
      .split('\n')
      .find((line) => remainingPattern().test(line))
    // 还没排序: 右上角只有剩余条数
    expect(beforeCorner).toBeDefined()
    expect(beforeCorner).not.toContain(t('stockList.sort.desc'))

    input.write('s')
    const descFrame = await waitForFrame(output, after, (candidate) =>
      plain(candidate).includes(t('stockList.sort.desc')),
    )
    // 排序后两段并排在同一行: 排序方向与剩余条数
    const corner = plain(descFrame)
      .split('\n')
      .find((line) => line.includes(t('stockList.sort.desc')))
    expect(corner).toBeDefined()
    expect(corner).toMatch(remainingPattern())
    assertFrameSize(descFrame, columns, rows)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的看板排序后方向键按显示顺序移动选中行', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {},
    step: {
      type: 'table',
      rows: [
        { kind: 'quote', code: 'sh600000', quote: testQuote({ code: 'sh600000', changePercent: 1 }) },
        { kind: 'quote', code: 'sz000001', quote: testQuote({ code: 'sz000001', changePercent: 5 }) },
        { kind: 'quote', code: 'sz300001', quote: testQuote({ code: 'sz300001', changePercent: -3 }) },
      ],
    },
  })

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    // 文件顺序的第一行默认选中
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === 'sh600000')

    // 降序显示顺序: sz000001(+5), sh600000(+1), sz300001(-3)
    input.write('s')
    await waitForFrame(
      output,
      after,
      (candidate) => plain(candidate).includes(t('stockList.sort.desc')) && selectedCodeIn(candidate) === 'sh600000',
    )

    // 文件顺序里 sh600000 的后一行是 sz000001, 显示顺序里是 sz300001
    input.write('j')
    const movedFrame = await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === 'sz300001')
    expect(plain(movedFrame).indexOf('sz000001')).toBeLessThan(plain(movedFrame).indexOf('sh600000'))

    input.write('k')
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === 'sh600000')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的看板刷新后按代码保持选中行, 选中股消失时按位置回退', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()
  const rowCodes = ['sh600000', 'sz000001', 'sz300001']
  // 每轮行情给一份新的自选股: 先是原样, 然后少一只, 最后换顺序
  const rounds = [rowCodes, ['sz000001', 'sz300001'], ['sz300001', 'sz000001']]
  let round = 0

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      const codes = rounds[Math.min(round, rounds.length - 1)]!
      round += 1
      useStockListStore.setState({
        step: { type: 'table', rows: codes.map((code) => ({ kind: 'missing', code })) },
      })
    },
  })

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === 'sh600000')

    // 选中的股票被删掉: 按它原来的位置回退到 sz000001
    input.write('r')
    await waitForFrame(
      output,
      after,
      (candidate) => !plain(candidate).includes('sh600000') && selectedCodeIn(candidate) === 'sz000001',
    )

    // 选中的股票还在, 只是换了位置: 选中行跟到新位置
    input.write('r')
    await waitForFrame(output, after, (candidate) => {
      const text = plain(candidate)
      return text.indexOf('sz300001') < text.indexOf('sz000001') && selectedCodeIn(candidate) === 'sz000001'
    })
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

/** 剩余条数随可视高度和窗口位置变化, 不是定值, 因此按文案模板取 */
const remainingPattern = () => new RegExp(t('stockList.remaining', { count: 0 }).replace('0', '\\d+'))

test('App 的看板排序后仍显示剩余条数, 即使视口被选中行带到列表底部', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()
  // 文件顺序按涨跌幅递增: 降序后首行落到列表末尾, 视口跟着它到底部
  const codes = Array.from({ length: 40 }, (_, index) => `sh6000${String(index).padStart(2, '0')}`)

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {},
    step: {
      type: 'table',
      rows: codes.map((code, index) => ({ kind: 'quote', code, quote: testQuote({ code, changePercent: index }) })),
    },
  })

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === codes[0])

    input.write('s')
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(t('stockList.sort.desc')))
    const text = plain(frame)
    // 视口已经贴到底部: 列表最上面的行被截掉, 选中的行还在
    expect(text).not.toContain(codes.at(-1)!)
    expect(text).toContain(codes[0]!)
    // 剩余条数是"没显示的行数", 因此这时仍然要显示
    const corner = text.split('\n').find((line) => line.includes(t('stockList.sort.desc')))
    expect(corner).toMatch(remainingPattern())
    assertFrameSize(frame, columns, rows)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的添加命令渲染自己的标题与 hint', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })
  useCommandStore.setState({ command: 'stock-add' })

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('添加自选股'))
    expect(plain(frame)).toContain(t('command.stockAdd.hint'))
    expect(plain(frame)).not.toMatch(/15:00 \(5000ms\)/)
    expect(plain(frame)).toMatch(/请输入股票代码/)
    assertFrameSize(frame, columns, rows)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的删除命令渲染自己的标题与 hint', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })
  useStockRemoveStore.setState({
    loadEntries: async () => {
      useStockRemoveStore.setState({ entries: [{ code: 'sh600000', name: '删除测试股' }] })
    },
  })
  useCommandStore.setState({ command: 'stock-remove' })

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('删除自选股'))
    expect(plain(frame)).toContain(t('command.stockRemove.hint'))
    expect(plain(frame)).not.toMatch(/15:00 \(5000ms\)/)
    expect(plain(frame)).toMatch(/删除测试股/)
    assertFrameSize(frame, columns, rows)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的设置命令渲染自己的标题与 hint', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })
  useCommandStore.setState({ command: 'settings' })

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('› 主题色系'))
    expect(plain(frame)).toContain(t('command.settings.title'))
    expect(plain(frame)).toContain(t('command.settings.hint'))
    assertFrameSize(frame, columns, rows)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('菜单 overlay 打开时底层命令变暗并保持命令自有的全屏 chrome', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })
  useCommandStore.setState({ command: 'stock-add' })

  const instance = renderApp(output)

  try {
    const brightFrame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('添加自选股'))
    expect(brightFrame).not.toContain('\u001B[2m')

    const after = output.frames.length
    useDialogMenuStore.getState().open('stock-add')
    const dimmedFrame = await waitForFrame(output, after, (candidate) => {
      const text = plain(candidate)
      return text.includes('添加自选股') && text.includes('自选股票看板') && candidate.includes('\u001B[2m')
    })
    expect(plain(dimmedFrame)).toMatch(/菜单/)
    expect(plain(dimmedFrame)).toContain(LOGO_LINES[0])
    assertFrameSize(dimmedFrame, columns, rows)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('删除确认弹窗 confirm 阶段忽略不在 hint 里的 esc', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output, input)

  try {
    const dialogStore = useDialogRemoveConfirmStore
    let after = output.frames.length
    dialogStore.getState().open([{ code: 'sh600000', name: '浦发银行' }])
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))

    input.write('\x1B')
    await delay(100)
    expect(dialogStore.getState().step.type).toBe('confirm')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('删除确认弹窗 confirm 阶段按 n 取消并保留网格勾选', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockRemoveStore.setState({
    loadEntries: async () => {
      useStockRemoveStore.setState({ entries: [{ code: 'sh600000', name: '浦发银行' }] })
    },
  })

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    useCommandStore.setState({ command: 'stock-remove' })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('浦发银行'))

    const dialogStore = useDialogRemoveConfirmStore
    const token = useStockRemoveStore.getState().resetToken
    after = output.frames.length
    dialogStore.getState().open([{ code: 'sh600000', name: '浦发银行' }])
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))

    after = output.frames.length
    input.write('n')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('确定删除选中的'))
    expect(dialogStore.getState().step).toStrictEqual({ type: 'idle' })
    // 勾选保留: 取消只关弹窗, 网格不重挂载
    expect(useStockRemoveStore.getState().resetToken).toBe(token)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('删除确认弹窗 confirm 阶段按 y 删除成功后同步网格并重挂载', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockRemoveStore.setState({
    loadEntries: async () => {
      useStockRemoveStore.setState({
        entries: [
          { code: 'sh600000', name: '浦发银行' },
          { code: 'sz000001', name: '平安银行' },
        ],
      })
    },
  })

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    useCommandStore.setState({ command: 'stock-remove' })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('浦发银行'))

    const dialogStore = useDialogRemoveConfirmStore
    const token = useStockRemoveStore.getState().resetToken
    // 存储动作 stub 成"删掉 1 条": 弹窗自己收尾, 网格同步交给 hook
    dialogStore.setState({
      confirmDelete: async (cb) => {
        cb?.(['sh600000'])
        dialogStore.setState({ step: { type: 'idle' }, entries: [] })
      },
    })

    after = output.frames.length
    dialogStore.getState().open([{ code: 'sh600000', name: '浦发银行' }])
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))

    after = output.frames.length
    input.write('y')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('确定删除选中的'))
    // 删掉的那条离开网格, 其余保留; resetToken 变化让网格重新挂载, 勾选清空
    expect(useStockRemoveStore.getState().entries.map((entry) => entry.code)).toStrictEqual(['sz000001'])
    expect(useStockRemoveStore.getState().resetToken).toBe(token + 1)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('删除确认弹窗 confirm 阶段按 y 删除失败时保留网格与勾选', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockRemoveStore.setState({
    loadEntries: async () => {
      useStockRemoveStore.setState({ entries: [{ code: 'sh600000', name: '浦发银行' }] })
    },
  })

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    useCommandStore.setState({ command: 'stock-remove' })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('浦发银行'))

    const dialogStore = useDialogRemoveConfirmStore
    const token = useStockRemoveStore.getState().resetToken
    // 删除失败: 弹窗进入 error, 不调 cb, 网格不该被改写
    dialogStore.setState({
      confirmDelete: async () => {
        dialogStore.setState({ step: { type: 'error', message: '删除失败: 锁超时' } })
        return
      },
    })

    after = output.frames.length
    dialogStore.getState().open([{ code: 'sh600000', name: '浦发银行' }])
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))

    after = output.frames.length
    input.write('y')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('删除失败'))
    // 文件没被改动: 条目与勾选都留着, esc 关闭后可以直接重试
    expect(useStockRemoveStore.getState().entries.map((entry) => entry.code)).toStrictEqual(['sh600000'])
    expect(useStockRemoveStore.getState().resetToken).toBe(token)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('删除确认弹窗 removing 阶段忽略 esc', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output, input)

  try {
    const dialogStore = useDialogRemoveConfirmStore
    const after = output.frames.length
    dialogStore.setState({ step: { type: 'removing' }, entries: [{ code: 'sh600000', name: '浦发银行' }] })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('正在删除'))

    input.write('\x1B')
    await delay(100)
    expect(dialogStore.getState().step.type).toBe('removing')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('删除确认弹窗 done 阶段 esc 关闭', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output, input)

  try {
    const dialogStore = useDialogRemoveConfirmStore
    let after = output.frames.length
    dialogStore.setState({
      step: { type: 'done', message: '已删除 1 个股票, 1 个条目已不在自选股中.' },
      entries: [],
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('删除完成'))

    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('删除完成'))
    expect(dialogStore.getState().step).toStrictEqual({ type: 'idle' })
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('删除确认弹窗 error 阶段 esc 关闭', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output, input)

  try {
    const dialogStore = useDialogRemoveConfirmStore
    let after = output.frames.length
    dialogStore.setState({
      step: { type: 'error', message: '删除失败: 锁超时' },
      entries: [{ code: 'sh600000', name: '浦发银行' }],
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('删除失败'))

    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('删除失败'))
    expect(dialogStore.getState().step).toStrictEqual({ type: 'idle' })
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('删除网格在条目没有名称时单元格只显示代码', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })
  useStockRemoveStore.setState({
    loadEntries: async () => {
      useStockRemoveStore.setState({ entries: [{ code: 'sh600000', name: undefined }] })
    },
  })
  useCommandStore.setState({ command: 'stock-remove' })

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(
      output,
      0,
      (candidate) => plain(candidate).includes('删除自选股') && plain(candidate).includes('sh600000'),
    )
    expect(plain(frame)).toContain('[ ] sh600000')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('删除确认弹窗在条目没有名称时只列代码, 不留空括号', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output)

  try {
    const after = output.frames.length
    useDialogRemoveConfirmStore.getState().open([{ code: 'sh600000', name: undefined }])
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))
    expect(plain(frame)).toContain('sh600000')
    expect(plain(frame)).not.toContain('(sh600000)')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('删除确认弹窗在条目有名称时列 名称 (代码)', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output)

  try {
    const after = output.frames.length
    useDialogRemoveConfirmStore.getState().open([{ code: 'sh600000', name: '浦发银行' }])
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))
    expect(plain(frame)).toContain('浦发银行 (sh600000)')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('通用确认弹窗确认态: hint 为 取消(n) 确定(y)', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output, input)

  try {
    const confirm = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const after = output.frames.length
    useDialogConfirmStore.setState({
      config: { title: '确认重置吗?', content: '此操作将重置所有设置与自选股为默认值.', isError: false, confirm },
    })
    const frame = await waitForFrame(
      output,
      after,
      (candidate) => plain(candidate).includes('确认重置吗') && plain(candidate).includes('取消(n)'),
    )
    expect(plain(frame)).toContain('确定(y)')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('通用确认弹窗错误态: update 换上失败信息并把 hint 切到 关闭(esc) 重试(y)', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output, input)

  try {
    const confirm = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    useDialogConfirmStore.setState({
      config: { title: '确认重置吗?', content: '此操作将重置所有设置与自选股为默认值.', isError: false, confirm },
    })

    const after = output.frames.length
    useDialogConfirmStore.getState().update({ content: '重置失败: 锁超时', isError: true })
    await waitForFrame(
      output,
      after,
      (candidate) =>
        plain(candidate).includes('重置失败: 锁超时') &&
        plain(candidate).includes('关闭(esc)') &&
        plain(candidate).includes('重试(y)'),
    )
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('通用确认弹窗错误态: 不在 hint 里的 n 被忽略', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    useDialogConfirmStore.setState({
      config: {
        title: '确认重置吗?',
        content: '重置失败: 锁超时',
        isError: true,
        confirm: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      },
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('重试(y)'))

    input.write('n')
    await delay(100)
    expect(useDialogConfirmStore.getState().config?.isError).toBe(true)
    expect(useDialogConfirmStore.getState().config?.content).toBe('重置失败: 锁超时')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('通用确认弹窗错误态: esc 关闭弹窗', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    useDialogConfirmStore.setState({
      config: {
        title: '确认重置吗?',
        content: '重置失败: 锁超时',
        isError: true,
        confirm: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      },
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('重试(y)'))

    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('确认重置吗'))
    expect(useDialogConfirmStore.getState().config).toBeUndefined()
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('通用确认弹窗错误态: y 重试成功后关闭弹窗', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output, input)

  try {
    const confirm = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    let after = output.frames.length
    useDialogConfirmStore.setState({
      config: { title: '确认重置吗?', content: '重置失败: 锁超时', isError: true, confirm },
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('重试(y)'))

    after = output.frames.length
    input.write('y')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('确认重置吗'))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(useDialogConfirmStore.getState().config).toBeUndefined()
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('通用确认弹窗错误态: y 重试失败时弹窗保留', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output, input)

  try {
    const confirm = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('锁超时'))
    const after = output.frames.length
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

test('App 的 esc 接线: esc 打开菜单, 再按 esc 关闭', async () => {
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

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('自选股票看板'))

    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => candidate.includes('\x1B[2m'))
    // 打开时的高亮由 App 传入当前命令
    expect(useDialogMenuStore.getState().highlightedType).toBe('stock-list')

    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => !candidate.includes('\x1B[2m'))
    expect(useDialogMenuStore.getState().highlightedType).toBeUndefined()
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 在 en 下渲染英文命令标题与表头', async () => {
  const columns = tableWidth(stockListColumns('en')) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useSettingsStore.setState({ language: 'en' })
  setActiveLocale('en')
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })

  const instance = renderApp(output, input)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('Market Cap'))
    expect(plain(frame)).toContain('Watchlist')
    expect(plain(frame)).toContain('Change %')
    expect(plain(frame)).toContain('Turnover %')
    assertFrameSize(frame, columns, rows)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 在 en 下用本地化单位渲染行情数值', async () => {
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
              quote: testQuote(),
            },
            { kind: 'missing', code: 'sz000001' },
          ],
        },
      })
    },
  })

  const instance = renderApp(output, input)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('Market Cap'))
    const text = plain(frame)
    // ScrollBox 只渲染测量到的窗口, 首行即行情行
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

test('App 的 vim 键: 看板 j/k 移动选中行', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({
        step: {
          type: 'table',
          rows: [
            { kind: 'missing', code: 'sh600000' },
            { kind: 'missing', code: 'sz000001' },
          ],
        },
      })
    },
  })

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('sh600000'))
    // hint 与监听同步: j/k 展示在状态栏, 也只在这些键上生效
    expect(plain(frame)).toContain('选择(↑/↓/j/k)')

    input.write('j')
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === 'sz000001')
    input.write('k')
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === 'sh600000')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的 vim 键: 菜单打开时 j/k 只移动菜单高亮, 看板选中行不动', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({
        step: {
          type: 'table',
          rows: [
            { kind: 'missing', code: 'sh600000' },
            { kind: 'missing', code: 'sz000001' },
          ],
        },
      })
    },
  })

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    input.write('\x1B')
    // 菜单打开后底层命令变暗: 不能匹配 '菜单', 状态栏的看板 hint 里也有这两个字
    const menuFrame = await waitForFrame(output, after, (candidate) => candidate.includes('\x1B[2m'))
    expect(plain(menuFrame)).toContain('选择(↑/↓/j/k)')

    input.write('j')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS[1]!.type)
    input.write('k')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS[0]!.type)
    // 菜单开着时看板仍是反显那一行, 选中行没被 j/k 带走
    const afterMenuKeys = await waitForFrame(output, after, (candidate) => candidate.includes('\x1B[2m'))
    expect(selectedCodeIn(afterMenuKeys)).toBe('sh600000')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的 vim 键: 设置命令 j/k 移动选中的配置项', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })
  useCommandStore.setState({ command: 'settings' })

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('› 主题色系'))

    after = output.frames.length
    input.write('j')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('› 涨跌颜色'))
    after = output.frames.length
    input.write('k')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('› 主题色系'))
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的 vim 键: 设置命令 h/l 切换 option 类配置项', async () => {
  const columns = tableWidth(STOCK_LIST_COLUMNS) + 10
  const rows = MIN_TERMINAL_ROWS + 6
  const output = new CaptureOutput(columns, rows)
  const input = createInput()

  resetStores()
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows: [] } })
    },
  })
  useCommandStore.setState({ command: 'settings' })

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    input.write('j')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('› 涨跌颜色'))

    const initialMode = useSettingsStore.getState().trendColorMode
    input.write('l')
    await waitForState(() => useSettingsStore.getState().trendColorMode !== initialMode)
    input.write('h')
    await waitForState(() => useSettingsStore.getState().trendColorMode === initialMode)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})
