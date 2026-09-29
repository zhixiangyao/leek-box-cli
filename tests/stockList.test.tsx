import { expect, test } from 'vitest'

import { setActiveLocale, t } from '../src/i18n/core.ts'
import { stockListColumns, tableWidth } from '../src/lib/quoteTable.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'
import { useStockListStore } from '../src/stores/useStockListStore.ts'
import {
  assertFrameSize,
  BOARD_COLUMNS,
  BOARD_ROWS,
  remainingPattern,
  remainingTextIn,
  renderApp,
  resetStores,
  selectedCodeIn,
  stubBoardRows,
} from './helpers/app.tsx'
import { missingRow, quote, quoteRow } from './helpers/fixtures.ts'
import { CaptureOutput, createInput, plain, waitForFrame } from './helpers/ink.tsx'

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
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
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
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的看板排序后右上角同时显示排序方向与剩余条数', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  // 行数多于可视窗口才有剩余条数可显示
  stubBoardRows(Array.from({ length: 40 }, (_, index) => missingRow(`sh6000${String(index).padStart(2, '0')}`)))

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
    assertFrameSize(descFrame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
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
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的看板刷新后按代码保持选中行, 选中股消失时按位置回退', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
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
        step: { type: 'table', rows: codes.map((code) => missingRow(code)) },
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

test('App 的看板排序时选中行还在窗口里就不滑动窗口, 剩余条数也不变', async () => {
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
    const beforeFrame = await waitForFrame(output, after, (candidate) => selectedCodeIn(candidate) === codes[0])
    const beforeCount = remainingTextIn(beforeFrame)
    expect(beforeCount).toBeDefined()

    input.write('s')
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(t('stockList.sort.desc')))
    const text = plain(frame)
    // 选中行换了位置, 但没移出窗口: 窗口原位不动, 条数因此不变
    expect(selectedCodeIn(frame)).toBe(codes[0])
    expect(text).toContain(codes.at(-1)!)
    expect(remainingTextIn(frame)).toBe(beforeCount)
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的看板排序把选中行带到列表底部时, 剩余条数显示 0 而不是消失', async () => {
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
    // 视口贴到底部: 列表最上面的行被截掉, 选中的行还在
    expect(text).not.toContain(codes.at(-1)!)
    expect(text).toContain(codes[0]!)
    // 下面没有行了, 条数是 0 而不是被隐藏
    const corner = text.split('\n').find((line) => line.includes(t('stockList.sort.desc')))
    expect(corner).toContain(t('stockList.remaining', { count: 0 }))
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
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
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
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
    // ScrollBox 只渲染测量到的窗口, 首行即行情行
    expect(text).toContain('611.0K lots')
    expect(text).toContain('550.0M')
    expect(text).toContain('298.75B')
    // 中文单位不再出现
    expect(text).not.toContain('亿')
    expect(text).not.toContain('万手')
    assertFrameSize(frame, columns, BOARD_ROWS)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
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
