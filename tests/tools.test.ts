import { expect, test } from 'vitest'

import { aggregateYearly, normalizeCode, withRequestTiming } from '../src/api/lib/tools.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'

test('normalizeCode 支持常见的 A 股代码格式', () => {
  expect(normalizeCode('600000.SH')).toBe('sh600000')
  expect(normalizeCode('SZ000001')).toBe('sz000001')
  expect(normalizeCode('920001')).toBe('bj920001')
  expect(normalizeCode('invalid')).toBeUndefined()
})

test('normalizeCode 覆盖沪深北各市场前缀', () => {
  expect(normalizeCode('600000')).toBe('sh600000')
  expect(normalizeCode('501000')).toBe('sh501000')
  expect(normalizeCode('000001')).toBe('sz000001')
  expect(normalizeCode('300750')).toBe('sz300750')
  expect(normalizeCode('150001')).toBe('sz150001')
  expect(normalizeCode('830001')).toBe('bj830001')
  expect(normalizeCode('430001')).toBe('bj430001')
  expect(normalizeCode('920001')).toBe('bj920001')
})

test('normalizeCode 剥离后缀与前缀且忽略大小写和空白', () => {
  expect(normalizeCode('  600000.sh ')).toBe('sh600000')
  expect(normalizeCode('sz000001')).toBe('sz000001')
})

test('normalizeCode 拒绝非法或不完整的代码', () => {
  expect(normalizeCode('12345')).toBeUndefined()
  expect(normalizeCode('700000')).toBeUndefined()
  expect(normalizeCode('abcdef')).toBeUndefined()
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
