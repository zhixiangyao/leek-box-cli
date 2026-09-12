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

/* ---------- 多语言单位 ---------- */

test('formatVolume 在英文下改用 lots 并以 K/M 换算', () => {
  expect(formatVolume(999, 'en')).toBe('999 lots')
  expect(formatVolume(1234, 'en')).toBe('1.2K lots')
  expect(formatVolume(611_000, 'en')).toBe('611.0K lots')
  expect(formatVolume(12_000_000, 'en')).toBe('12.0M lots')
  expect(formatVolume(0, 'en')).toBe('--')
})

test('formatVolume 在繁体下使用張', () => {
  expect(formatVolume(1234, 'zh-hant')).toBe('1234張')
  expect(formatVolume(611_000, 'zh-hant')).toBe('61.1萬張')
})

test('formatTurnover 在英文下改用 K/M', () => {
  expect(formatTurnover(880, 'en')).toBe('8.8M')
  expect(formatTurnover(55_000, 'en')).toBe('550.0M')
  expect(formatTurnover(5, 'en')).toBe('50.0K')
  expect(formatTurnover(0, 'en')).toBe('--')
})

test('formatTurnover 在繁体下使用萬與億', () => {
  expect(formatTurnover(880, 'zh-hant')).toBe('880.0萬')
  expect(formatTurnover(55_000, 'zh-hant')).toBe('5.50億')
})

test('formatMarketCap 在英文下改用 M/B', () => {
  expect(formatMarketCap(2987.53, 'en')).toBe('298.75B')
  expect(formatMarketCap(1, 'en')).toBe('100.0M')
  expect(formatMarketCap(0, 'en')).toBe('--')
})

test('formatMarketCap 在繁体下使用億', () => {
  expect(formatMarketCap(2987.53, 'zh-hant')).toBe('2987.53億')
})

test('单位函数默认使用简体中文, 与显式传参一致', () => {
  for (const value of [0, 1234, 611_000, 55_000, 2987.53]) {
    expect(formatVolume(value)).toBe(formatVolume(value, 'zh-hans'))
    expect(formatTurnover(value)).toBe(formatTurnover(value, 'zh-hans'))
    expect(formatMarketCap(value)).toBe(formatMarketCap(value, 'zh-hans'))
  }
})

/* ---------- 档位边界进位 ---------- */

test('四舍五入进位到上一档时改用上一档渲染', () => {
  // 999950 手用 K 档会渲染成 1000.0K, 进位为 1.0M
  expect(formatVolume(999_949, 'en')).toBe('999.9K lots')
  expect(formatVolume(999_950, 'en')).toBe('1.0M lots')
  expect(formatVolume(999_999, 'en')).toBe('1.0M lots')

  // 9.9999 亿用 M 档会渲染成 1000.0M, 进位为 1.00B
  expect(formatMarketCap(9.99, 'en')).toBe('999.0M')
  expect(formatMarketCap(9.9999, 'en')).toBe('1.00B')

  // 9999.99 万元用万档会渲染成 10000.0万, 进位为 1.00亿
  expect(formatTurnover(9999.9)).toBe('9999.9万')
  expect(formatTurnover(9999.99)).toBe('1.00亿')
  expect(formatTurnover(9999.99, 'zh-hant')).toBe('1.00億')
})

test('未到上一档起点的档位不进位', () => {
  // 每档的 min 与 scale 对应, 因此档位下界渲染为 1.0 而不是两位数
  expect(formatVolume(999, 'en')).toBe('999 lots')
  expect(formatVolume(1_000, 'en')).toBe('1.0K lots')
  expect(formatVolume(999_499, 'en')).toBe('999.5K lots')

  // 中文没有 K 档, 万手/万元档是最高档, 不做进位检查
  expect(formatVolume(999_999)).toBe('100.0万手')
  expect(formatTurnover(999_999)).toBe('100.00亿')
})
