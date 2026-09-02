import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

import { expect, test } from 'vitest'

import {
  initializeSettings,
  loadStocks,
  patchSettings,
  replaceStocks,
  resetSettingsFile,
  settingsPath,
  stocksAdd,
  stocksRemove,
} from '../src/settings/file.ts'
import {
  createDocument,
  DEFAULT_SETTINGS,
  parseSettingsDocument,
  parseStocks,
  settingsFromDocument,
  type Settings,
  type SettingsDocument,
  type StockEntry,
} from '../src/settings/schema.ts'

const validStock: StockEntry = { code: 'sh600000', name: '浦发银行', addedAt: '2026-08-20T00:00:00.000Z' }

const validDocument = (): SettingsDocument => ({
  theme: { preset: 'classic', trendColorMode: 'red-up', borderStyle: 'round' },
  request: {
    timeoutMs: 8000,
    minimumDurationMs: 0,
    quotePollIntervalMs: 5000,
    minuteChartPollIntervalMs: 30_000,
    klinePollIntervalMs: 300_000,
  },
  stocks: [validStock],
})

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
      stocksAdd([validStock]),
      stocksAdd([{ code: 'sz000001', name: '平安银行', addedAt: '2026-08-20T00:00:01.000Z' }]),
    ])
    const entries = await loadStocks()
    const codes = entries.map((entry) => entry.code)
    expect(codes).toContain('sh600000')
    expect(codes).toContain('sz000001')
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('resetSettingsFile 覆盖已有设置为默认值', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    await patchSettings({ themePreset: 'ocean', requestTimeoutMs: 20_000 })
    await stocksAdd([validStock])

    await resetSettingsFile()

    const document = await initializeSettings()
    expect(document.theme).toStrictEqual({ preset: 'classic', trendColorMode: 'red-up', borderStyle: 'round' })
    expect(document.request.timeoutMs).toBe(8000)
    expect(document.stocks.map((entry) => entry.code)).toStrictEqual(['sz002156', 'sh600584', 'sh688825'])
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('resetSettingsFile 修复损坏的设置文件', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    await mkdir(dirname(settingsPath()), { recursive: true })
    await writeFile(settingsPath(), '{ 无法解析', 'utf8')

    await resetSettingsFile()

    const document = await initializeSettings()
    expect(document.theme.preset).toBe('classic')
    expect(await loadStocks()).toHaveLength(3)
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('initializeSettings 首次运行时创建带默认自选股的文档', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    const document = await initializeSettings()
    expect(document.theme).toStrictEqual({ preset: 'classic', trendColorMode: 'red-up', borderStyle: 'round' })
    expect(document.request.timeoutMs).toBe(8000)
    expect(document.stocks.map((entry) => entry.code)).toStrictEqual(['sz002156', 'sh600584', 'sh688825'])
    expect(document.stocks.every((entry) => entry.addedAt.length > 0)).toBe(true)
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('initializeSettings 读取带 UTF-8 BOM 的配置文件', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    await mkdir(dirname(settingsPath()), { recursive: true })
    await writeFile(settingsPath(), `﻿${JSON.stringify(validDocument())}`, 'utf8')

    const document = await initializeSettings()
    expect(document.stocks).toStrictEqual([validStock])
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('initializeSettings 对损坏的 JSON 报错', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    await mkdir(dirname(settingsPath()), { recursive: true })
    await writeFile(settingsPath(), '{ 无法解析', 'utf8')

    await expect(initializeSettings()).rejects.toThrow(/设置文件损坏/)
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('initializeSettings 对字段非法的文档报错', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    await mkdir(dirname(settingsPath()), { recursive: true })
    await writeFile(
      settingsPath(),
      JSON.stringify({ ...validDocument(), theme: { preset: 'bad', borderStyle: 'round' } }),
      'utf8',
    )

    await expect(initializeSettings()).rejects.toThrow(/设置文件损坏/)
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('patchSettings 只修改设置字段并保留已有自选股', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    await replaceStocks([])
    await stocksAdd([validStock])
    await patchSettings({ themePreset: 'ocean' })

    const document = await initializeSettings()
    expect(document.theme.preset).toBe('ocean')
    expect(document.stocks).toStrictEqual([validStock])
    // 文件完整持久化, 再次启动可读取
    expect(await loadStocks()).toStrictEqual([validStock])
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('stocksRemove 删除匹配的自选股并持久化结果, 不存在的代码返回 0', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    await replaceStocks([])
    await stocksAdd([validStock, { code: 'sz000001', name: '平安银行', addedAt: '2026-08-20T00:00:01.000Z' }])

    expect(await stocksRemove(['sz000001'])).toBe(1)
    expect(await loadStocks()).toStrictEqual([validStock])

    expect(await stocksRemove(['sz000001'])).toBe(0)
    expect(await stocksRemove([])).toBe(0)
    expect(await loadStocks()).toStrictEqual([validStock])
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('stocksAdd 重复代码返回 0 且保持列表不变', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    await replaceStocks([])
    expect(await stocksAdd([validStock])).toBe(1)
    expect(await stocksAdd([validStock])).toBe(0)
    expect(await loadStocks()).toStrictEqual([validStock])
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('replaceStocks 整表替换自选股并校验条目', async () => {
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  try {
    await stocksAdd([validStock])
    const replacement = { code: 'sz300001', name: '特锐德', addedAt: '2026-08-20T00:00:02.000Z' }
    await replaceStocks([replacement])
    expect(await loadStocks()).toStrictEqual([replacement])

    await expect(replaceStocks([{ code: 'bad', name: 'x', addedAt: '2026-08-20T00:00:02.000Z' }])).rejects.toThrow(
      /code 无效/,
    )
  } finally {
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('parseSettingsDocument 校验主题并采用默认涨跌颜色模式', () => {
  const document = validDocument()
  expect(parseSettingsDocument(document)).toStrictEqual(document)

  const withoutTrendColor = { ...document, theme: { preset: 'ocean', borderStyle: 'double' } as object }
  expect(parseSettingsDocument(withoutTrendColor).theme).toStrictEqual({
    preset: 'ocean',
    trendColorMode: 'red-up',
    borderStyle: 'double',
  })

  expect(() => parseSettingsDocument({ ...document, theme: { preset: 'neon', borderStyle: 'round' } })).toThrow(
    /theme.preset 无效/,
  )
  expect(() => parseSettingsDocument({ ...document, theme: { preset: 'classic', borderStyle: 'wavy' } })).toThrow(
    /theme.borderStyle 无效/,
  )
})

test('parseSettingsDocument 校验请求参数并拒绝相互矛盾的值', () => {
  const document = validDocument()
  const parse = (request: object) => parseSettingsDocument({ ...document, request })

  expect(parse({ ...document.request, timeoutMs: 10_000 }).request.timeoutMs).toBe(10_000)
  expect(() => parse({ ...document.request, timeoutMs: 500 })).toThrow(/request.timeoutMs 无效/)
  expect(() => parse({ ...document.request, quotePollIntervalMs: 100.5 })).toThrow(/request.quotePollIntervalMs 无效/)
  expect(() => parse({ ...document.request, timeoutMs: 1000, minimumDurationMs: 2000 })).toThrow(
    /minimumDurationMs 不能大于/,
  )
})

test('createDocument 与 settingsFromDocument 往返保持一致', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, themePreset: 'forest', borderStyle: 'bold' }
  const document = createDocument(settings, [validStock])
  expect(settingsFromDocument(document)).toStrictEqual(settings)
  expect(document.stocks).toStrictEqual([validStock])
})
