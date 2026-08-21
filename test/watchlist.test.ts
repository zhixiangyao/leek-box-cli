import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import test from 'node:test'

import { addStock, loadWatchlist, parseWatchlist } from '../src/lib/watchlist.ts'

const validEntry = { code: 'sh600000', name: '浦发银行', addedAt: '2026-08-20T00:00:00.000Z' }

test('parseWatchlist 接受完整的持久化数据结构', () => {
  assert.deepEqual(parseWatchlist([validEntry]), [validEntry])
})

test('parseWatchlist 拒绝缺少字段的数据并标明条目位置', () => {
  assert.throws(() => parseWatchlist([{ code: 'sh600000', name: '浦发银行' }]), /第 1 项 addedAt 无效/)
  assert.throws(() => parseWatchlist([{ ...validEntry, code: '600000' }]), /第 1 项 code 无效/)
})

test('parseWatchlist 拒绝重复的股票代码', () => {
  assert.throws(() => parseWatchlist([validEntry, { ...validEntry, name: '重复项' }]), /第 2 项 code 重复/)
})

test('并发更新自选股时保留两个条目', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    await Promise.all([
      addStock(validEntry),
      addStock({ code: 'sz000001', name: '平安银行', addedAt: '2026-08-20T00:00:01.000Z' }),
    ])
    const entries = await loadWatchlist()
    assert.deepEqual(entries.map((entry) => entry.code).sort(), ['sh600000', 'sz000001'])
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})
