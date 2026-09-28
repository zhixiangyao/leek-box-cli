import { expect, test } from 'vitest'

import { aggregateYearly, withRequestTiming } from '../src/api/lib/tools.ts'
import { visibleWindow } from '../src/commands/StockList/lib.ts'
import { keyDirection } from '../src/lib/keys.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'

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
