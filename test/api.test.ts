import { expect, test } from 'vitest'

import { normalizeCode, parseIntradayResponse, parseQuoteText } from '../src/api/index.ts'

test('normalizeCode 支持常见的 A 股代码格式', () => {
  expect(normalizeCode('600000.SH')).toBe('sh600000')
  expect(normalizeCode('SZ000001')).toBe('sz000001')
  expect(normalizeCode('920001')).toBe('bj920001')
  expect(normalizeCode('invalid')).toBeUndefined()
})

test('parseQuoteText 映射腾讯字段并跳过格式错误的记录', () => {
  const fields = Array<string>(50).fill('')
  fields[1] = '浦发银行'
  fields[3] = '10.25'
  fields[4] = '10.00'
  fields[5] = '10.10'
  fields[30] = '20260820150000'
  fields[31] = '0.25'
  fields[32] = '2.50'
  fields[33] = '10.30'
  fields[34] = '9.95'
  fields[36] = '12345'
  fields[37] = '6789'
  fields[38] = '1.20'
  fields[43] = '3.50'
  fields[45] = '2000'
  fields[49] = '1.10'

  const [quote] = parseQuoteText(`garbage;v_sh600000="${fields.join('~')}";`)
  expect(quote).toStrictEqual({
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
    volume: 12345,
    turnover: 6789,
    turnoverRate: 1.2,
    amplitude: 3.5,
    marketCap: 2000,
    volumeRatio: 1.1,
  })
})

test('parseIntradayResponse 过滤格式错误和收盘后的数据点', () => {
  const points = parseIntradayResponse(
    {
      data: {
        sh600000: {
          data: {
            data: [
              '0930 10.00 100 1000',
              '1260 10.10 200 2000',
              '1500 10.20 300 3000',
              '1501 10.30 400 4000',
              'bad',
              42,
            ],
          },
        },
      },
    },
    'sh600000',
  )

  expect(points).toStrictEqual([
    { time: '0930', price: 10, volume: 100 },
    { time: '1500', price: 10.2, volume: 300 },
  ])
  expect(parseIntradayResponse({}, 'sh600000')).toStrictEqual([])
})
