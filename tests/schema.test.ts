import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

import { afterEach, beforeEach, expect, test } from 'vitest'

import { setActiveLocale, t } from '../src/i18n/core.ts'
import { DEFAULT_LOCALE, detectLocale, LANGUAGES } from '../src/i18n/locale.ts'
import { errorMessage } from '../src/lib/error.ts'
import { TREND_COLOR_MODES } from '../src/lib/format.ts'
import { APP_VERSION } from '../src/lib/version.ts'
import { initializeSettings, settingsPath } from '../src/settings/file.ts'
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

const validStock: StockEntry = { code: 'sh600000', addedAt: '2026-08-20T00:00:00.000Z' }

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

test('parseStocks 接受完整的持久化数据结构', () => {
  expect(parseStocks([validStock])).toStrictEqual([validStock])
})

test('parseStocks 拒绝缺少字段的数据并标明条目位置', () => {
  expect(() => parseStocks([{ code: 'sh600000' }])).toThrow(/第 1 项 addedAt 无效/)
  expect(() => parseStocks([{ ...validStock, code: '600000' }])).toThrow(/第 1 项 code 无效/)
})

test('parseStocks 拒绝重复的股票代码', () => {
  expect(() => parseStocks([validStock, validStock])).toThrow(/第 2 项 code 重复/)
})

test('parseStocks 忽略旧文档里的 name 字段: 名称不再是持久化数据', () => {
  expect(parseStocks([{ ...validStock, name: '浦发银行' }])).toStrictEqual([validStock])
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
