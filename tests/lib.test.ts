import { expect, test } from 'vitest'

import { aggregateYearly, withRequestTiming } from '../src/api/lib/tools.ts'
import type { Quote } from '../src/api/types.ts'
import {
  clampSelection,
  displayedRows,
  rowIndex,
  anchoredScrollOffset,
  scrollOffsetAfterReorder,
  SORT_MODE_CYCLE,
  sortedRows,
  type StockListSortMode,
  visibleWindow,
} from '../src/commands/StockList/lib.ts'
import { keyDirection } from '../src/lib/keys.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'
import type { StockListRow } from '../src/stores/useStockListStore.ts'

/** 只关心涨跌幅的行情行 */
const quoteRow = (code: string, changePercent: number): StockListRow => {
  const quote: Quote = {
    code,
    name: code,
    current: 10,
    prevClose: 9,
    open: 9.5,
    high: 10.5,
    low: 9.4,
    change: 1,
    changePercent,
    timestamp: '20260820150000',
    volume: 100,
    turnover: 200,
    turnoverRate: 1,
    amplitude: 2,
    marketCap: 300,
    volumeRatio: 1.2,
  }
  return { kind: 'quote', code, quote }
}

const missingRow = (code: string): StockListRow => ({ kind: 'missing', code })

const rowCodes = (rows: StockListRow[]) => rows.map((row) => row.code)

test('sortedRows 按涨跌幅排序, 缺失行始终在末尾', () => {
  const rows = [quoteRow('sh600000', 1), missingRow('sh600001'), quoteRow('sz000001', 5), quoteRow('sz300001', -3)]

  // default 原样返回同一个数组, 即自选股文件顺序
  expect(sortedRows(rows, 'default')).toBe(rows)
  expect(rowCodes(sortedRows(rows, 'desc'))).toStrictEqual(['sz000001', 'sh600000', 'sz300001', 'sh600001'])
  expect(rowCodes(sortedRows(rows, 'asc'))).toStrictEqual(['sz300001', 'sh600000', 'sz000001', 'sh600001'])
  // 排序不改原数组: 写回 step.rows 就会丢掉文件顺序, 回到 default 也就回不去了
  expect(rowCodes(rows)).toStrictEqual(['sh600000', 'sh600001', 'sz000001', 'sz300001'])
})

test('sortedRows 保持同涨跌幅行的文件顺序', () => {
  const rows = [quoteRow('sh600000', 2), quoteRow('sz000001', 2), quoteRow('sz300001', 2)]

  expect(rowCodes(sortedRows(rows, 'desc'))).toStrictEqual(['sh600000', 'sz000001', 'sz300001'])
  expect(rowCodes(sortedRows(rows, 'asc'))).toStrictEqual(['sh600000', 'sz000001', 'sz300001'])
})

test('SORT_MODE_CYCLE 三态循环后回到文件顺序', () => {
  const modes: StockListSortMode[] = ['default']
  for (let step = 0; step < 3; step += 1) {
    modes.push(SORT_MODE_CYCLE[modes.at(-1)!])
  }

  expect(modes).toStrictEqual(['default', 'desc', 'asc', 'default'])
})

test('displayedRows 只在看板步骤下给出显示顺序', () => {
  const rows = [quoteRow('sh600000', 1), quoteRow('sz000001', 5)]

  expect(displayedRows({ type: 'loading' }, 'desc')).toStrictEqual([])
  expect(displayedRows({ type: 'empty' }, 'desc')).toStrictEqual([])
  expect(displayedRows({ type: 'table', rows }, 'desc').map((row) => row.code)).toStrictEqual(['sz000001', 'sh600000'])
})

test('rowIndex 与 clampSelection 把下标限制在有效范围内', () => {
  const rows = [missingRow('sh600000'), missingRow('sz000001')]

  expect(rowIndex(rows, 'sz000001')).toBe(1)
  // 没有选中行或该行已不在列表里时取首行
  expect(rowIndex(rows, undefined)).toBe(0)
  expect(rowIndex(rows, 'sh600001')).toBe(0)
  expect(clampSelection(-5, 3)).toBe(0)
  expect(clampSelection(9, 3)).toBe(2)
})

test('anchoredScrollOffset 只在选中行移出窗口时带动窗口', () => {
  // 窗口 [0, 3): 选中行往下走到第 3 行时窗口跟着走一行
  expect(anchoredScrollOffset(1, 1, 10, 0, 3)).toBe(0)
  expect(anchoredScrollOffset(1, 2, 10, 0, 3)).toBe(1)
  // 往上走到窗口外时窗口顶到选中行
  expect(anchoredScrollOffset(-1, 3, 10, 4, 3)).toBe(2)
  // 不让窗口越过最大偏移
  expect(anchoredScrollOffset(1, 8, 10, 7, 3)).toBe(7)
})

test('scrollOffsetAfterReorder 让选中行停在窗口里的同一行', () => {
  const visible = 5
  // 选中行从第 8 行 (index 7) 换到 index 4, 窗口停到 [2, 7), 选中行仍在视口内
  const next = scrollOffsetAfterReorder(7, 4, 5)
  expect(next).toBe(2)
  expect(next).toBeLessThanOrEqual(4)
  expect(4).toBeLessThan(next + visible)

  // 顺序没变时偏移不变, 移到首行时窗口回到顶部
  expect(scrollOffsetAfterReorder(3, 3, 2)).toBe(2)
  expect(scrollOffsetAfterReorder(7, 0, 5)).toBe(0)
})

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

/** 只列出需要置位的方向键标志位, 其余按键位默认为 false */
const arrows = (pressed: Partial<Record<'upArrow' | 'downArrow' | 'leftArrow' | 'rightArrow', true>>) => ({
  upArrow: false,
  downArrow: false,
  leftArrow: false,
  rightArrow: false,
  ...pressed,
})

test('keyDirection 把方向键和 vim 键映射到同一个方向', () => {
  expect(keyDirection('', arrows({ upArrow: true }))).toBe('up')
  expect(keyDirection('', arrows({ downArrow: true }))).toBe('down')
  expect(keyDirection('', arrows({ leftArrow: true }))).toBe('left')
  expect(keyDirection('', arrows({ rightArrow: true }))).toBe('right')

  expect(keyDirection('k', arrows({}))).toBe('up')
  expect(keyDirection('j', arrows({}))).toBe('down')
  expect(keyDirection('h', arrows({}))).toBe('left')
  expect(keyDirection('l', arrows({}))).toBe('right')
})

test('keyDirection 不吞掉各界面自己的快捷键', () => {
  // q/esc/r/d/空格/数字/enter 以及大写 (shift) 字母都要留给调用方判断
  for (const input of ['q', 'd', 'r', '1', ' ', '\r', 'K', 'J', 'H', 'L']) {
    expect(keyDirection(input, arrows({})), input).toBeUndefined()
  }
})

test('aggregateYearly 按年份排序并合并年度 OHLC 与成交量', () => {
  const monthly = [
    { date: '2026-02-28', open: 11, close: 12, high: 13, low: 10, volume: 20 },
    { date: '2025-12-31', open: 8, close: 9, high: 10, low: 7, volume: 40 },
    { date: '2026-01-31', open: 9, close: 10, high: 11, low: 8, volume: 30 },
  ]
  const original = structuredClone(monthly)

  expect(aggregateYearly(monthly)).toStrictEqual([
    { date: '2025-12-31', open: 8, close: 9, high: 10, low: 7, volume: 40 },
    { date: '2026-02-28', open: 9, close: 12, high: 13, low: 8, volume: 50 },
  ])
  expect(monthly).toStrictEqual(original)
})

test('withRequestTiming 在最小请求时长期间响应调用方取消', async () => {
  const previousMinimumDuration = useSettingsStore.getState().minimumRequestDurationMs
  useSettingsStore.getState().updateSettings({ minimumRequestDurationMs: 100 })
  const controller = new AbortController()

  try {
    const promise = withRequestTiming(controller.signal, async (signal) => {
      expect(signal).toBeInstanceOf(AbortSignal)
      return 'ok'
    })
    setTimeout(() => controller.abort(), 10)

    await expect(promise).rejects.toBeDefined()
  } finally {
    useSettingsStore.getState().updateSettings({ minimumRequestDurationMs: previousMinimumDuration })
  }
})
