import { expect, test } from 'vitest'

import { normalizeCode } from '../src/api/index.ts'
import { parseFiveDayResponse, parseHistoricalResponse, parseQuoteText } from '../src/api/parsers.ts'

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

test('parseQuoteText 在没有任何有效行情时抛错', () => {
  expect(() => parseQuoteText('garbage without quotes')).toThrow(/未查询到任何行情数据/)
})

test('parseFiveDayResponse 按日期升序展开并附带会话元数据', () => {
  const points = parseFiveDayResponse(
    {
      data: {
        sh600000: {
          data: [
            { date: '20260819', prec: '10.10', data: ['0930 10.20 100', '0931 10.25 150'] },
            { date: '20260818', prec: '9.90', data: ['0930 9.95 100', 'bad', '1501 9.80 200'] },
          ],
        },
      },
    },
    'sh600000',
  )

  expect(points).toStrictEqual([
    { time: '0930', price: 9.95, volume: 100, sessionDate: '2026-08-18', prevClose: 9.9 },
    { time: '0930', price: 10.2, volume: 100, sessionDate: '2026-08-19', prevClose: 10.1 },
    { time: '0931', price: 10.25, volume: 150, sessionDate: '2026-08-19', prevClose: 10.1 },
  ])
})

test('parseFiveDayResponse 跳过日期格式非法的会话, 缺失数据返回空数组', () => {
  expect(
    parseFiveDayResponse(
      { data: { sh600000: { data: [{ date: '2026-08-18', prec: '9.9', data: ['0930 10.00 100'] }] } } },
      'sh600000',
    ),
  ).toStrictEqual([])
  expect(parseFiveDayResponse({}, 'sh600000')).toStrictEqual([])
})

test('parseHistoricalResponse 解析复权 K 线并过滤非法行', () => {
  const points = parseHistoricalResponse(
    {
      data: {
        sh600000: {
          qfqday: [
            ['2026-08-18', '10.00', '10.20', '10.30', '9.90', '12345'],
            ['2026-08-19', '10.20', '0', '10.40', '10.10', '6789'],
            ['bad-date', '10.20', '10.30', '10.40', '10.10', '100'],
            'not-an-array',
          ],
        },
      },
    },
    'sh600000',
  )

  expect(points).toStrictEqual([{ date: '2026-08-18', open: 10, close: 10.2, high: 10.3, low: 9.9, volume: 12_345 }])
})

test('parseHistoricalResponse 在复权数据为空时回退到原始粒度数据', () => {
  const points = parseHistoricalResponse(
    {
      data: {
        sh600000: {
          qfqday: [],
          day: [['2026-08-18', '10.00', '10.20', '10.30', '9.90', '-5']],
        },
      },
    },
    'sh600000',
  )

  expect(points).toStrictEqual([{ date: '2026-08-18', open: 10, close: 10.2, high: 10.3, low: 9.9, volume: 0 }])
})
