import { expect, test } from 'vitest'

import { setActiveLocale, t } from '../src/i18n/core.ts'
import { stockListColumns, tableWidth } from '../src/lib/quoteTable.ts'
import { useDialogMenuStore } from '../src/stores/useDialogMenuStore.ts'
import { useDialogRemoveConfirmStore } from '../src/stores/useDialogRemoveConfirmStore.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'
import { useStockListStore } from '../src/stores/useStockListStore.ts'
import {
  assertFrameSize,
  BOARD_COLUMNS,
  BOARD_ROWS,
  renderApp,
  resetStores,
  selectedCodeIn,
  stubBoardRows,
} from './helpers/app.tsx'
import { missingRow, quote, quoteRow } from './helpers/fixtures.ts'
import {
  CaptureOutput,
  createInput,
  plain,
  unmountApp,
  waitForFrame,
  waitForInput,
  waitForState,
} from './helpers/ink.tsx'

test('App 的看板命令渲染自己的标题, hint 与列顺序', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows([])

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
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板排序键 s: 按涨跌幅排序并在右上角显示方向', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  // 轮询不动行情, 用例只关心排序键对已有行的作用
  stubBoardRows([missingRow('sz000001'), { kind: 'quote', code: 'sh600000', quote: quote() }])

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
    assertFrameSize(descFrame, BOARD_COLUMNS, BOARD_ROWS)

    input.write('s')
    const ascFrame = await waitForFrame(output, after, (candidate) =>
      plain(candidate).includes(t('stockList.sort.asc')),
    )
    expect(plain(ascFrame)).not.toContain(t('stockList.sort.desc'))
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板排序后右上角用 | 分隔排序方向与刷新间隔', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()
  const interval = t('stockList.refreshInterval', { value: 3000 })

  resetStores()
  useSettingsStore.setState({ quotePollIntervalMs: 3000 })
  stubBoardRows([missingRow('sh600000'), missingRow('sz000001')])

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(interval))

    input.write('s')
    const descFrame = await waitForFrame(output, after, (candidate) =>
      plain(candidate).includes(t('stockList.sort.desc')),
    )
    // 排序后两段并排在同一行, 中间是分隔符
    const corner = plain(descFrame)
      .split('\n')
      .find((line) => line.includes(t('stockList.sort.desc')))
    expect(corner).toContain(`${t('stockList.sort.desc')} | ${interval}`)
    assertFrameSize(descFrame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板右上角固定显示刷新间隔', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const interval = t('stockList.refreshInterval', { value: 3000 })

  resetStores()
  useSettingsStore.setState({ quotePollIntervalMs: 3000 })
  // 两行放得下整个窗口, 又没有排序: 除了刷新间隔右上角没有别的段
  stubBoardRows([missingRow('sh600000'), missingRow('sz000001')])

  const instance = renderApp(output)

  try {
    const after = output.frames.length
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(interval))
    const corner = plain(frame)
      .split('\n')
      .find((line) => line.includes(interval))
    // 间隔和标题同在上边框那一行, 没有排序时右上角只有它一段, 因此没有分隔符
    expect(corner).toContain(t('command.stockList.title'))
    expect(corner).toContain(`|${interval}|`)
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板在首轮行情返回前也显示刷新间隔', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const interval = t('stockList.refreshInterval', { value: 3000 })

  resetStores()
  useSettingsStore.setState({ quotePollIntervalMs: 3000 })
  // 行情一直不返回: 看板停在 loading 态
  useStockListStore.setState({ refreshQuotes: () => new Promise<void>(() => {}) })

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes(t('stockList.loading')))
    // 间隔来自设置而不是某次刷新的结果, 因此 loading 态也在
    expect(plain(frame)).toContain(interval)
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板按 d 打开删除确认弹窗, n 取消不动看板', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()
  const dialogStore = useDialogRemoveConfirmStore
  const title = t('dialogRemoveConfirm.titleConfirm', { count: 1 })
  let refreshCalls = 0

  resetStores()
  useStockListStore.setState({
    step: { type: 'table', rows: [quoteRow('sh600000', 1), missingRow('sz000001')] },
    refreshQuotes: async () => {
      refreshCalls += 1
    },
  })

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === 'sh600000')
    const beforeRefreshCalls = refreshCalls

    // d 打开确认弹窗: 条目取选中行的代码与实时行情里的名称
    input.write('d')
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(title))
    expect(plain(frame)).toContain('浦发银行 (sh600000)')
    expect(dialogStore.getState().entries).toStrictEqual([{ code: 'sh600000', name: '浦发银行' }])

    // n 取消: 弹窗关闭, 看板没被改动, 也不触发刷新
    let closedAfter = output.frames.length
    input.write('n')
    const closedFrame = await waitForFrame(output, closedAfter, (candidate) => !plain(candidate).includes(title))
    expect(dialogStore.getState().step.type).toBe('idle')
    expect(refreshCalls).toBe(beforeRefreshCalls)
    expect(selectedCodeIn(closedFrame)).toBe('sh600000')

    // 缺失行 (行情没返回该代码) 也允许删: 弹窗条目没有名称, 因此只列代码
    input.write('j')
    await waitForFrame(output, closedAfter, (candidate) => selectedCodeIn(candidate) === 'sz000001')
    closedAfter = output.frames.length
    input.write('d')
    await waitForFrame(output, closedAfter, (candidate) => plain(candidate).includes(title))
    expect(dialogStore.getState().entries).toStrictEqual([{ code: 'sz000001', name: undefined }])
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板按 d 删除后刷新一次, 那一行消失且选中行回退到邻近行', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()
  const dialogStore = useDialogRemoveConfirmStore
  const title = t('dialogRemoveConfirm.titleConfirm', { count: 1 })
  const boardRows = [quoteRow('sh600000', 1), missingRow('sz000001'), missingRow('sz300001')]
  // 删除写盘后重读自选股: 少了一开始的选中股
  const rowsAfterDelete = [missingRow('sz000001'), missingRow('sz300001')]
  let deleted = false
  let refreshCalls = 0

  resetStores()
  useStockListStore.setState({
    step: { type: 'table', rows: boardRows },
    refreshQuotes: async () => {
      refreshCalls += 1
      useStockListStore.setState({ step: { type: 'table', rows: deleted ? rowsAfterDelete : boardRows } })
    },
  })
  // 存储动作 stub: 弹窗自己收尾, 收尾动作是看板的 hook 在 open 时登记的
  dialogStore.setState({
    confirmDelete: async () => {
      deleted = true
      dialogStore.getState().onRemoved?.(['sh600000'])
      dialogStore.setState({ step: { type: 'idle' }, entries: [], onRemoved: undefined })
    },
  })

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === 'sh600000')
    const beforeRefreshCalls = refreshCalls

    input.write('d')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(title))
    expect(dialogStore.getState().onRemoved).toBeDefined()

    input.write('y')
    // 收尾动作触发一次刷新: 被删的那只离开列表, 选中行按原下标落到 sz000001
    const frame = await waitForFrame(
      output,
      after,
      (candidate) => !plain(candidate).includes('sh600000') && selectedCodeIn(candidate) === 'sz000001',
    )
    expect(refreshCalls).toBe(beforeRefreshCalls + 1)
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板排序后方向键按显示顺序移动选中行', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([quoteRow('sh600000', 1), quoteRow('sz000001', 5), quoteRow('sz300001', -3)])

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
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板刷新后按代码保持选中行, 选中股消失时按位置回退', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const rowCodes = ['sh600000', 'sz000001', 'sz300001']
  // 每轮行情给一份新的自选股: 先是原样, 然后少一只, 最后换顺序
  const rounds = [rowCodes, ['sz000001', 'sz300001'], ['sz300001', 'sz000001']]
  let round = 0

  resetStores()
  // 刷新只由轮询驱动, 间隔调小, 用例不必等满一个默认周期
  useSettingsStore.setState({ quotePollIntervalMs: 100 })
  useStockListStore.setState({
    refreshQuotes: async () => {
      const codes = rounds[Math.min(round, rounds.length - 1)]!
      round += 1
      useStockListStore.setState({
        step: { type: 'table', rows: codes.map((code) => missingRow(code)) },
      })
    },
  })

  const instance = renderApp(output)

  try {
    const after = output.frames.length
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === 'sh600000')

    // 选中的股票被删掉: 按它原来的位置回退到 sz000001
    await waitForFrame(
      output,
      after,
      (candidate) => !plain(candidate).includes('sh600000') && selectedCodeIn(candidate) === 'sz000001',
    )

    // 选中的股票还在, 只是换了位置: 选中行跟到新位置
    await waitForFrame(output, after, (candidate) => {
      const text = plain(candidate)
      return text.indexOf('sz300001') < text.indexOf('sz000001') && selectedCodeIn(candidate) === 'sz000001'
    })
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板排序时选中行还在窗口里就不滑动窗口', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()
  const codes = Array.from({ length: 40 }, (_, index) => `sh6000${String(index).padStart(2, '0')}`)
  // 首行涨跌幅偏高: 降序后它落到列表靠前的位置, 仍在窗口里
  const percents = codes.map((_, index) => (index === 0 ? 34 : index))

  resetStores()
  stubBoardRows(codes.map((code, index) => quoteRow(code, percents[index]!)))

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === codes[0])

    input.write('s')
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(t('stockList.sort.desc')))
    const text = plain(frame)
    // 选中行换了位置, 但没移出窗口: 窗口原位不动, 显示顺序的第一行还在窗口里
    expect(selectedCodeIn(frame)).toBe(codes[0])
    expect(text).toContain(codes.at(-1)!)
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板排序把选中行带到列表底部时窗口跟着贴到底', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()
  // 文件顺序按涨跌幅递增: 降序后首行落到列表末尾, 窗口被带到最底部
  const codes = Array.from({ length: 40 }, (_, index) => `sh6000${String(index).padStart(2, '0')}`)

  resetStores()
  stubBoardRows(codes.map((code, index) => quoteRow(code, index)))

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === codes[0])

    input.write('s')
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(t('stockList.sort.desc')))
    const text = plain(frame)
    // 视口贴到底部: 显示顺序最上面的行被截掉, 选中的行还在
    expect(text).not.toContain(codes.at(-1)!)
    expect(text).toContain(codes[0]!)
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 在 en 下渲染英文命令标题与表头', async () => {
  const columns = tableWidth(stockListColumns('en')) + 10
  const output = new CaptureOutput(columns, BOARD_ROWS)
  const input = createInput()

  resetStores()
  useSettingsStore.setState({ language: 'en' })
  setActiveLocale('en')
  stubBoardRows([])

  const instance = renderApp(output, input)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('Market Cap'))
    expect(plain(frame)).toContain('Watchlist')
    expect(plain(frame)).toContain('Change %')
    expect(plain(frame)).toContain('Turnover %')
    assertFrameSize(frame, columns, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 在 en 下用本地化单位渲染行情数值', async () => {
  const columns = tableWidth(stockListColumns('en')) + 10
  const output = new CaptureOutput(columns, BOARD_ROWS)
  const input = createInput()

  resetStores()
  useSettingsStore.setState({ language: 'en' })
  setActiveLocale('en')
  stubBoardRows([{ kind: 'quote', code: 'sh600000', quote: quote() }, missingRow('sz000001')])

  const instance = renderApp(output, input)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('Market Cap'))
    const text = plain(frame)
    // 表头在 ScrollBox 之外, 窗口首行即行情行
    expect(text).toContain('611.0K lots')
    expect(text).toContain('550.0M')
    expect(text).toContain('298.75B')
    // 中文单位不再出现
    expect(text).not.toContain('亿')
    expect(text).not.toContain('万手')
    assertFrameSize(frame, columns, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的 vim 键: 看板 j/k 移动选中行', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([missingRow('sh600000'), missingRow('sz000001')])

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('sh600000'))
    // hint 与监听同步: j/k 展示在状态栏, 也只在这些键上生效
    expect(plain(frame)).toContain('选择(↑/↓/j/k/gg/G)')

    input.write('j')
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === 'sz000001')
    input.write('k')
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === 'sh600000')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板 vim 键: gg 跳到顶部, G 跳到底部', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()
  // 行数多于可视窗口: 首尾两行不会同框, 窗口位置因此能从帧里断言
  const codes = Array.from({ length: 40 }, (_, index) => `sh6000${String(index).padStart(2, '0')}`)

  resetStores()
  stubBoardRows(codes.map((code) => missingRow(code)))

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === codes[0])

    // G 跳到底部: 选中末行, 窗口跟着贴到底
    input.write('G')
    const bottomFrame = await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === codes.at(-1)!)
    expect(plain(bottomFrame)).not.toContain(codes[0]!)

    // 单个 g 只是一个前缀: 它后面的 k 照常向上走一行, 说明 g 自己没跳
    input.write('g')
    await waitForInput()
    input.write('k')
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === codes.at(-2)!)

    // gg 跳到顶部: 选中首行, 窗口跟着回到顶部
    input.write('g')
    await waitForInput()
    input.write('g')
    const topFrame = await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === codes[0])
    expect(plain(topFrame)).not.toContain(codes.at(-1)!)
    assertFrameSize(topFrame, BOARD_COLUMNS, BOARD_ROWS)
    // hint 与监听同步: 序列键也展示在状态栏
    expect(plain(topFrame)).toContain('选择(↑/↓/j/k/gg/G)')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的看板 vim 键: gg 的前缀不跨越浮层', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()
  const codes = Array.from({ length: 40 }, (_, index) => `sh6000${String(index).padStart(2, '0')}`)

  resetStores()
  stubBoardRows(codes.map((code) => missingRow(code)))

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === codes[0])

    input.write('G')
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === codes.at(-1)!)
    // 置起前缀后开菜单再关掉: 浮层期间本 hook 收不到按键, 收尾键落在浮层之外
    input.write('g')
    await waitForInput()
    input.write('\x1B')
    await waitForState(() => useDialogMenuStore.getState().highlightedType !== undefined)
    input.write('\x1B')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === undefined)

    // 关掉菜单后的这个 g 是新的第一键, 后面的 k 照常向上走一行
    input.write('g')
    await waitForInput()
    input.write('k')
    await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === codes.at(-2)!)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
