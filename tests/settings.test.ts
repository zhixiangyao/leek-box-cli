import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

import { afterEach, beforeEach, expect, test } from 'vitest'

import { setActiveLocale, t } from '../src/i18n/core.ts'
import { DEFAULT_LOCALE, detectLocale, LANGUAGES } from '../src/i18n/locale.ts'
import { errorMessage } from '../src/lib/error.ts'
import { TREND_COLOR_MODES } from '../src/lib/format.ts'
import { APP_VERSION } from '../src/lib/version.ts'
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
  BORDER_STYLES,
  createDocument,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  parseSettingsDocument,
  parseStocks,
  SchemaVersionTooNewError,
  settingsFromDocument,
  THEME_PRESET_NAMES,
  type Settings,
  type SettingsDocument,
  type StockEntry,
} from '../src/settings/schema.ts'

let configHome: string
let previousConfigHome: string | undefined

beforeEach(async () => {
  configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-test-'))
  previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome
  // 本文件断言中文校验文案, 固定语言避免跟随运行环境的系统语言
  setActiveLocale(DEFAULT_LOCALE)
})

afterEach(async () => {
  if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
  else process.env['XDG_CONFIG_HOME'] = previousConfigHome
  await rm(configHome, { recursive: true, force: true })
  setActiveLocale(DEFAULT_LOCALE)
})

const validStock: StockEntry = { code: 'sh600000', name: '浦发银行', addedAt: '2026-08-20T00:00:00.000Z' }

const validDocument = (): SettingsDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  appVersion: APP_VERSION,
  language: 'auto',
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

/** 解析文档, 路径是 parseSettingsDocument 的报错上下文 ("版本过新" 的文案里要带出来源文件) */
const parseDocument = (value: unknown) => parseSettingsDocument(value, settingsPath())

/** 读原始文件: 回读会补上缺失的版本字段, 只有原始读才能断言 "真的写进去了" */
const storedDocument = async (): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(settingsPath(), 'utf8')) as Record<string, unknown>

/** 取回必然失败的调用的错误本身, 用于逐字比对消息 */
const errorOf = async (action: () => Promise<unknown>): Promise<unknown> => {
  try {
    return await action()
  } catch (error) {
    return error
  }
}

/** parseSchemaVersion 该抛的文案: 带来源路径与双方版本号 */
const tooNewMessage = (version: number) =>
  t('settings.error.schemaVersionNewer', { path: settingsPath(), version, supported: CURRENT_SCHEMA_VERSION })

/** 版本非法时的文案: 外层是 loadExistingSettings 的 corruptFile, 括号内是 parseSchemaVersion 的原因 */
const invalidVersionMessage = () =>
  t('settings.error.corruptFile', {
    path: settingsPath(),
    error: t('settings.error.schemaVersion', { supported: CURRENT_SCHEMA_VERSION }),
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
  await Promise.all([
    stocksAdd([validStock]),
    stocksAdd([{ code: 'sz000001', name: '平安银行', addedAt: '2026-08-20T00:00:01.000Z' }]),
  ])
  const entries = await loadStocks()
  const codes = entries.map((entry) => entry.code)
  expect(codes).toContain('sh600000')
  expect(codes).toContain('sz000001')
})

test('resetSettingsFile 覆盖已有设置为默认值', async () => {
  await patchSettings({ themePreset: 'ocean', requestTimeoutMs: 20_000 })
  await stocksAdd([validStock])

  await resetSettingsFile()

  const document = await initializeSettings()
  expect(document.theme).toStrictEqual({ preset: 'classic', trendColorMode: 'red-up', borderStyle: 'round' })
  expect(document.request.timeoutMs).toBe(8000)
  expect(document.stocks.map((entry) => entry.code)).toStrictEqual(['sz002156', 'sh600584', 'sh688825'])
})

test('resetSettingsFile 修复损坏的设置文件', async () => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  await writeFile(settingsPath(), '{ 无法解析', 'utf8')

  await resetSettingsFile()

  const document = await initializeSettings()
  expect(document.theme.preset).toBe('classic')
  expect(await loadStocks()).toHaveLength(3)
})

test('initializeSettings 首次运行时创建带默认自选股的文档', async () => {
  const document = await initializeSettings()
  expect(document.theme).toStrictEqual({ preset: 'classic', trendColorMode: 'red-up', borderStyle: 'round' })
  expect(document.request.timeoutMs).toBe(8000)
  expect(document.stocks.map((entry) => entry.code)).toStrictEqual(['sz002156', 'sh600584', 'sh688825'])
  expect(document.stocks.every((entry) => entry.addedAt.length > 0)).toBe(true)
})

test('initializeSettings 读取带 UTF-8 BOM 的配置文件', async () => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  await writeFile(settingsPath(), `﻿${JSON.stringify(validDocument())}`, 'utf8')

  const document = await initializeSettings()
  expect(document.stocks).toStrictEqual([validStock])
})

test('initializeSettings 对损坏的 JSON 报错', async () => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  await writeFile(settingsPath(), '{ 无法解析', 'utf8')

  await expect(initializeSettings()).rejects.toThrow(/设置文件损坏/)
})

test('initializeSettings 对字段非法的文档报错', async () => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  await writeFile(
    settingsPath(),
    JSON.stringify({ ...validDocument(), theme: { preset: 'bad', borderStyle: 'round' } }),
    'utf8',
  )

  await expect(initializeSettings()).rejects.toThrow(/设置文件损坏/)
})

test('patchSettings 只修改设置字段并保留已有自选股', async () => {
  await replaceStocks([])
  await stocksAdd([validStock])
  await patchSettings({ themePreset: 'ocean' })

  const document = await initializeSettings()
  expect(document.theme.preset).toBe('ocean')
  expect(document.stocks).toStrictEqual([validStock])
  // 文件完整持久化, 再次启动可读取
  expect(await loadStocks()).toStrictEqual([validStock])
})

test('stocksRemove 删除匹配的自选股并持久化结果, 不存在的代码返回 0', async () => {
  await replaceStocks([])
  await stocksAdd([validStock, { code: 'sz000001', name: '平安银行', addedAt: '2026-08-20T00:00:01.000Z' }])

  expect(await stocksRemove(['sz000001'])).toBe(1)
  expect(await loadStocks()).toStrictEqual([validStock])

  expect(await stocksRemove(['sz000001'])).toBe(0)
  expect(await stocksRemove([])).toBe(0)
  expect(await loadStocks()).toStrictEqual([validStock])
})

test('stocksAdd 重复代码返回 0 且保持列表不变', async () => {
  await replaceStocks([])
  expect(await stocksAdd([validStock])).toBe(1)
  expect(await stocksAdd([validStock])).toBe(0)
  expect(await loadStocks()).toStrictEqual([validStock])
})

test('replaceStocks 整表替换自选股并校验条目', async () => {
  await stocksAdd([validStock])
  const replacement = { code: 'sz300001', name: '特锐德', addedAt: '2026-08-20T00:00:02.000Z' }
  await replaceStocks([replacement])
  expect(await loadStocks()).toStrictEqual([replacement])

  await expect(replaceStocks([{ code: 'bad', name: 'x', addedAt: '2026-08-20T00:00:02.000Z' }])).rejects.toThrow(
    /code 无效/,
  )
})

test('首次创建时写入的文档带 schemaVersion 与 appVersion', async () => {
  const created = await initializeSettings()
  expect(created.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  expect(created.appVersion).toBe(APP_VERSION)

  // 回读会把缺失的版本字段补成当前版本, 因此只断言写出来的原始文件
  const stored = await storedDocument()
  expect(stored['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
  expect(stored['appVersion']).toBe(APP_VERSION)
})

test('缺失版本字段的旧文件按当前版本接受, 并在下次写盘时补齐两个字段', async () => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  const { schemaVersion: _schemaVersion, appVersion: _appVersion, ...withoutVersion } = validDocument()
  await writeFile(settingsPath(), JSON.stringify(withoutVersion), 'utf8')

  const loaded = await initializeSettings()
  expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  expect(loaded.appVersion).toBe(APP_VERSION)

  await stocksAdd([{ code: 'sz000001', name: '平安银行', addedAt: '2026-08-20T00:00:01.000Z' }])
  const stored = await storedDocument()
  expect(stored['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
  expect(stored['appVersion']).toBe(APP_VERSION)
})

test('appVersion 非法时回落到当前应用版本, 不拦住启动', async () => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  for (const appVersion of [0.5, '', null, true, {}]) {
    await writeFile(settingsPath(), JSON.stringify({ ...validDocument(), appVersion }), 'utf8')
    expect((await initializeSettings()).appVersion, JSON.stringify(appVersion)).toBe(APP_VERSION)
  }
})

test('appVersion 是非空字符串时原样读回, 不做 trim', async () => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  await writeFile(settingsPath(), JSON.stringify({ ...validDocument(), appVersion: ' 0.5.4 ' }), 'utf8')

  expect((await initializeSettings()).appVersion).toBe(' 0.5.4 ')
})

test('读改写路径把两个版本字段都盖成当前值, 而读取保留文件里的旧值', async () => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  // appVersion 必须旧但有效: 字段缺失或非法会回落到 APP_VERSION, 那样写入时不覆盖也看不出问题
  const writeOldVersionDocument = async () =>
    writeFile(settingsPath(), JSON.stringify({ ...validDocument(), appVersion: '0.0.1' }), 'utf8')
  const writes: ReadonlyArray<{ name: string; write: () => Promise<unknown> }> = [
    { name: 'patchSettings', write: () => patchSettings({ themePreset: 'ocean' }) },
    {
      name: 'stocksAdd',
      write: () => stocksAdd([{ code: 'sz000001', name: '平安银行', addedAt: '2026-08-20T00:00:01.000Z' }]),
    },
    { name: 'stocksRemove', write: () => stocksRemove(['sh600000']) },
    { name: 'replaceStocks', write: () => replaceStocks([validStock]) },
    { name: 'resetSettingsFile', write: () => resetSettingsFile() },
  ]

  for (const { name, write } of writes) {
    await writeOldVersionDocument()
    expect((await initializeSettings()).appVersion, name).toBe('0.0.1')

    await write()

    const stored = await storedDocument()
    expect(stored['appVersion'], name).toBe(APP_VERSION)
    expect(stored['schemaVersion'], name).toBe(CURRENT_SCHEMA_VERSION)
  }
})

test('schemaVersion 高于当前支持时抛 SchemaVersionTooNewError, 消息带路径与双方版本号', async () => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  const version = CURRENT_SCHEMA_VERSION + 1
  await writeFile(settingsPath(), JSON.stringify({ ...validDocument(), schemaVersion: version }), 'utf8')

  const error = await errorOf(() => initializeSettings())
  expect(error).toBeInstanceOf(SchemaVersionTooNewError)
  // 不套 "设置文件损坏" 的措辞: 文件没坏, 只是这份程序读不懂
  expect(errorMessage(error)).toBe(tooNewMessage(version))
})

test('判版本早于字段校验: 高版本文档缺字段也报升级提示, 不报损坏', async () => {
  const { request: _request, ...withoutRequest } = validDocument()
  const version = CURRENT_SCHEMA_VERSION + 1
  const missingRequest = { ...withoutRequest, schemaVersion: version }

  // 新版本可能已改名或移除 request: 先报字段缺失会让用户以为文件坏了
  expect(await errorOf(async () => parseDocument(missingRequest))).toBeInstanceOf(SchemaVersionTooNewError)
  expect(await errorOf(async () => parseDocument({ schemaVersion: version }))).toBeInstanceOf(SchemaVersionTooNewError)

  await mkdir(dirname(settingsPath()), { recursive: true })
  await writeFile(settingsPath(), JSON.stringify(missingRequest), 'utf8')
  expect(errorMessage(await errorOf(() => initializeSettings()))).toBe(tooNewMessage(version))
})

test('高版本配置下读写全部拒绝, 文件内容一字不动', async () => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  const content = JSON.stringify({
    ...validDocument(),
    schemaVersion: CURRENT_SCHEMA_VERSION + 1,
    // 当前程序读不懂的字段: 一旦按白名单重建写回, 丢的就是它
    futureField: 'keep',
  })
  await writeFile(settingsPath(), content, 'utf8')

  await expect(loadStocks()).rejects.toThrow(SchemaVersionTooNewError)
  await expect(patchSettings({ themePreset: 'ocean' })).rejects.toThrow(SchemaVersionTooNewError)
  await expect(stocksAdd([validStock])).rejects.toThrow(SchemaVersionTooNewError)
  await expect(stocksRemove(['sh600000'])).rejects.toThrow(SchemaVersionTooNewError)
  await expect(replaceStocks([])).rejects.toThrow(SchemaVersionTooNewError)
  // 重设同样拒绝: 覆盖一份读不懂的文档等于丢数据, 它只修损坏的文件
  await expect(resetSettingsFile()).rejects.toThrow(SchemaVersionTooNewError)

  expect(await readFile(settingsPath(), 'utf8')).toBe(content)
})

test('版本过新的错误带上文件里的 language, 缺失或非法时留空由入口回退', async () => {
  const version = CURRENT_SCHEMA_VERSION + 1
  const languageOf = async (document: object) => {
    const error = await errorOf(async () => parseDocument(document))
    expect(error).toBeInstanceOf(SchemaVersionTooNewError)
    return (error as SchemaVersionTooNewError).language
  }

  expect(await languageOf({ ...validDocument(), schemaVersion: version, language: 'en' })).toBe('en')
  // language 本身读不出来时不能拦住那句升级提示, 由入口回退系统语言
  expect(await languageOf({ ...validDocument(), schemaVersion: version, language: 'ja-JP' })).toBeUndefined()
  expect(await languageOf({ schemaVersion: version })).toBeUndefined()
})

test('schemaVersion 非法时报损坏并说明支持的版本, 且不改动文件', async () => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  for (const schemaVersion of [0, -1, 1.5, '1', null, true]) {
    const content = JSON.stringify({ ...validDocument(), schemaVersion })
    await writeFile(settingsPath(), content, 'utf8')

    expect(errorMessage(await errorOf(() => initializeSettings())), JSON.stringify(schemaVersion)).toBe(
      invalidVersionMessage(),
    )
    expect(await readFile(settingsPath(), 'utf8'), JSON.stringify(schemaVersion)).toBe(content)
  }
})

test('parseSettingsDocument 校验主题并采用默认涨跌颜色模式', () => {
  const document = validDocument()
  expect(parseDocument(document)).toStrictEqual(document)

  const withoutTrendColor = { ...document, theme: { preset: 'ocean', borderStyle: 'double' } as object }
  expect(parseDocument(withoutTrendColor).theme).toStrictEqual({
    preset: 'ocean',
    trendColorMode: 'red-up',
    borderStyle: 'double',
  })

  expect(() => parseDocument({ ...document, theme: { preset: 'neon', borderStyle: 'round' } })).toThrow(
    new RegExp(`theme.preset 无效, 只支持: ${THEME_PRESET_NAMES.join(', ')}`),
  )
  expect(() =>
    parseDocument({
      ...document,
      theme: { preset: 'classic', trendColorMode: 'blue-up', borderStyle: 'round' },
    }),
  ).toThrow(new RegExp(`theme.trendColorMode 无效, 只支持: ${TREND_COLOR_MODES.join(', ')}`))
  expect(() => parseDocument({ ...document, theme: { preset: 'classic', borderStyle: 'wavy' } })).toThrow(
    new RegExp(`theme.borderStyle 无效, 只支持: ${BORDER_STYLES.join(', ')}`),
  )
})

test('parseSettingsDocument 校验请求参数并拒绝相互矛盾的值', () => {
  const document = validDocument()
  const parse = (request: object) => parseDocument({ ...document, request })

  expect(parse({ ...document.request, timeoutMs: 10_000 }).request.timeoutMs).toBe(10_000)
  expect(() => parse({ ...document.request, timeoutMs: 500 })).toThrow(/request.timeoutMs 无效/)
  expect(() => parse({ ...document.request, quotePollIntervalMs: 100.5 })).toThrow(/request.quotePollIntervalMs 无效/)
  expect(() => parse({ ...document.request, timeoutMs: 1000, minimumDurationMs: 2000 })).toThrow(
    /minimumDurationMs 不能大于/,
  )
})

test('parseSettingsDocument 校验界面语言并接受字段缺失', () => {
  const document = validDocument()
  expect(parseDocument({ ...document, language: 'zh-hant' }).language).toBe('zh-hant')

  const withoutLanguage: Record<string, unknown> = { ...document }
  delete withoutLanguage['language']
  expect(parseDocument(withoutLanguage).language).toBe('auto')

  expect(() => parseDocument({ ...document, language: 'ja-JP' })).toThrow(
    new RegExp(`language 无效, 只支持: ${LANGUAGES.join(', ')}`),
  )
  expect(() => parseDocument({ ...document, language: 1 })).toThrow(/language 无效/)
})

test('parseSettingsDocument 的语言报错跟随已生效 locale, 而非抛出时重新检测', () => {
  // LC_ALL 与 active locale 故意不一致: parseCli 在读取设置文件前已按系统语言生效,
  // 若实现改成抛错时重新检测系统语言, 这里会渲染成中文而断言失败
  const previous = process.env['LC_ALL']
  process.env['LC_ALL'] = 'zh_CN.UTF-8'
  try {
    // 先钉住前提: 万一 LC_ALL 不再是检测来源, 下面的断言会失去区分度而静默通过
    expect(detectLocale()).toBe('zh-hans')
    setActiveLocale('en')
    expect(() => parseDocument({ ...validDocument(), language: 'ja-JP' })).toThrow(
      `language is invalid, supported values: ${LANGUAGES.join(', ')}`,
    )
  } finally {
    if (previous === undefined) delete process.env['LC_ALL']
    else process.env['LC_ALL'] = previous
  }
})

test('createDocument 与 settingsFromDocument 往返保持一致', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, themePreset: 'forest', borderStyle: 'bold' }
  const document = createDocument(settings, [validStock])
  expect(settingsFromDocument(document)).toStrictEqual(settings)
  expect(document.stocks).toStrictEqual([validStock])
})
