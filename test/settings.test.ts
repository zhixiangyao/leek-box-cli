import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

import { expect, test } from 'vitest'

import { stockAdd, loadStocks, parseStocks } from '../src/lib/settings.ts'

const validStock = { code: 'sh600000', name: '浦发银行', addedAt: '2026-08-20T00:00:00.000Z' }

test('parseStocks 接受完整的持久化数据结构', () => {
  expect(parseStocks([validStock])).toStrictEqual([validStock])
})

test('parseStocks 拒绝缺少字段的数据并标明条目位置', () => {
  expect(() => parseStocks([{ code: 'sh600000', name: '浦发银行' }])).toThrow(/第 1 项 addedAt 无效/)
  expect(() => parseStocks([{ ...validStock, code: '600000' }])).toThrow(/第 1 项 code 无效/)
})

test('parseStocks 拒绝重复的股票代码', () => {
  expect(() => parseStocks([validStock, { ...validStock, name: '重复项' }])).toThrow(/第 2 项 code 重复/)
})

test('并发更新自选股时保留两个条目', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    await Promise.all([
      stockAdd(validStock),
      stockAdd({ code: 'sz000001', name: '平安银行', addedAt: '2026-08-20T00:00:01.000Z' }),
    ])
    const entries = await loadStocks()
    expect(entries.map((entry) => entry.code).sort()).toStrictEqual(['sh600000', 'sz000001'])
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})
