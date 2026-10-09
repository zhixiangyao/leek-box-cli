import stringWidth from 'string-width'
import { expect, test } from 'vitest'

import { indexSegments, typewriterSegments } from '../src/components/MarketIndexTicker/lib.ts'
import type { Row } from '../src/lib/quoteTable.ts'
import { quote } from './helpers/fixtures.ts'

const rowText = (row: Row) => row.map((segment) => segment.text).join('')

test('indexSegments 名称段用默认色, 数值段按涨跌幅取涨跌色', () => {
  const index = (overrides: Parameters<typeof quote>[0]) =>
    quote({ code: 'sh000001', name: '上证指数', current: 3245.67, change: 12.34, changePercent: 0.38, ...overrides })

  expect(indexSegments(index({}), 'red-up')).toStrictEqual([
    { text: '上证指数 ' },
    { text: '3245.67 +12.34 +0.38%', color: 'red' },
  ])
  // green-up 下涨用绿色, 跌用红色
  expect(indexSegments(index({}), 'green-up')[1]?.color).toBe('green')
  expect(indexSegments(index({ change: -28.46, changePercent: -0.75 }), 'red-up')[1]).toStrictEqual({
    text: '3245.67 -28.46 -0.75%',
    color: 'green',
  })
  expect(indexSegments(index({ change: 0, changePercent: 0 }), 'red-up')[1]?.color).toBe('gray')
})

test('typewriterSegments 按进度写出前缀, 行宽始终保持整行宽度', () => {
  const segments = indexSegments(
    quote({ code: 'sh000001', name: '上证指数', current: 3245.67, change: 12.34, changePercent: 0.38 }),
    'red-up',
  )
  const fullText = rowText(segments)
  const totalWidth = stringWidth(fullText)

  // 进度 0 是整行空格: 位置在写出第一个字之前就占好
  expect(typewriterSegments(segments, 0)).toStrictEqual([{ text: ' '.repeat(totalWidth) }])
  // 进度 1 原样返回: 写完不再补空格
  expect(typewriterSegments(segments, 1)).toStrictEqual(segments)

  for (const progress of [0, 0.2, 0.45, 0.7, 1]) {
    const revealed = rowText(typewriterSegments(segments, progress))
    // 行宽恒定, 居中槽位里的文字才不会左右跳
    expect(stringWidth(revealed)).toBe(totalWidth)
    // 写出的必是整行的前缀, 后面全是补白
    expect(fullText.startsWith(revealed.trimEnd())).toBe(true)
  }
})

test('typewriterSegments 不切出半个 CJK 字', () => {
  // '上证指数' 每字 2 列: 第 7 列落在 '数' 的左半边, 该字留给下一帧, 由下一段的 'a' 补上
  const segments: Row = [{ text: '上证指数' }, { text: 'abc', color: 'red' }]
  const revealed = typewriterSegments(segments, 7 / 11)

  expect(revealed[0]).toStrictEqual({ text: '上证指' })
  expect(revealed[1]).toStrictEqual({ text: 'a', color: 'red' })
  expect(rowText(revealed)).toBe(`上证指a${' '.repeat(4)}`)
})

test('typewriterSegments 保留段落颜色', () => {
  const segments: Row = [{ text: '上证指数 ' }, { text: '3245.67', color: 'red' }]
  const revealed = typewriterSegments(segments, 1)

  expect(revealed[1]).toStrictEqual({ text: '3245.67', color: 'red' })
})
