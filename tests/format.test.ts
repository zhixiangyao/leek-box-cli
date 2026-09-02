import { expect, test } from 'vitest'

import {
  formatClock,
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatRate,
  formatRatio,
  formatSigned,
  formatTurnover,
  formatVolume,
  trendColor,
} from '../src/lib/format.ts'

test('formatPrice 保留两位小数, 非正值显示占位符', () => {
  expect(formatPrice(12.3)).toBe('12.30')
  expect(formatPrice(0)).toBe('--')
  expect(formatPrice(-1.5)).toBe('--')
})

test('formatSigned 为正值补加号, 零和负值保持原样', () => {
  expect(formatSigned(1.2)).toBe('+1.20')
  expect(formatSigned(0)).toBe('0.00')
  expect(formatSigned(-0.45)).toBe('-0.45')
})

test('formatPercent 为正值补加号并追加百分号', () => {
  expect(formatPercent(2.5)).toBe('+2.50%')
  expect(formatPercent(0)).toBe('0.00%')
  expect(formatPercent(-1.25)).toBe('-1.25%')
})

test('trendColor 默认涨红跌绿, 零值为灰', () => {
  expect(trendColor(1)).toBe('red')
  expect(trendColor(-1)).toBe('green')
  expect(trendColor(0)).toBe('gray')
})

test('trendColor 在涨绿跌红模式下翻转红绿', () => {
  expect(trendColor(1, 'green-up')).toBe('green')
  expect(trendColor(-1, 'green-up')).toBe('red')
  expect(trendColor(0, 'green-up')).toBe('gray')
})

test('formatVolume 以万手为界切换单位, 非正值显示占位符', () => {
  expect(formatVolume(1234)).toBe('1234手')
  expect(formatVolume(611_000)).toBe('61.1万手')
  expect(formatVolume(10_000)).toBe('1.0万手')
  expect(formatVolume(0)).toBe('--')
})

test('formatTurnover 以亿为界切换单位, 非正值显示占位符', () => {
  expect(formatTurnover(880)).toBe('880.0万')
  expect(formatTurnover(55_000)).toBe('5.50亿')
  expect(formatTurnover(0)).toBe('--')
})

test('formatRate 不带符号追加百分号, 非正值显示占位符', () => {
  expect(formatRate(1.33)).toBe('1.33%')
  expect(formatRate(0)).toBe('--')
  expect(formatRate(-2)).toBe('--')
})

test('formatRatio 保留两位小数, 非正值显示占位符', () => {
  expect(formatRatio(1.21)).toBe('1.21')
  expect(formatRatio(0)).toBe('--')
})

test('formatMarketCap 追加亿单位, 非正值显示占位符', () => {
  expect(formatMarketCap(2987.53)).toBe('2987.53亿')
  expect(formatMarketCap(0)).toBe('--')
})

test('formatClock 从时间戳截取时分秒', () => {
  expect(formatClock('20260820150000')).toBe('15:00:00')
  expect(formatClock('20260820093015')).toBe('09:30:15')
})
