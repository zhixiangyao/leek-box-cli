import { afterEach, beforeEach, expect, test } from 'vitest'

import { CATALOGS } from '../src/i18n/catalog/index.ts'
import { applyLanguage, createTranslator, getActiveLocale, setActiveLocale, t } from '../src/i18n/core.ts'
import { DEFAULT_LOCALE, detectLocale, LOCALES, resolveLanguage } from '../src/i18n/locale.ts'
import type { MessageKey, MessageValue } from '../src/i18n/types.ts'

const LOCALE_ENV_KEYS = ['LC_ALL', 'LC_MESSAGES', 'LANG'] as const

const originalEnv = LOCALE_ENV_KEYS.map((name) => [name, process.env[name]] as const)

const clearLocaleEnv = () => {
  for (const name of LOCALE_ENV_KEYS) delete process.env[name]
}

beforeEach(() => {
  clearLocaleEnv()
  setActiveLocale(DEFAULT_LOCALE)
})

afterEach(() => {
  clearLocaleEnv()
  for (const [name, value] of originalEnv) {
    if (value !== undefined) process.env[name] = value
  }
  setActiveLocale(DEFAULT_LOCALE)
})

/* ---------- 系统语言检测 ---------- */

test('detectLocale 按 LC_ALL > LC_MESSAGES > LANG 的优先级取值', () => {
  process.env['LANG'] = 'zh_TW.UTF-8'
  expect(detectLocale()).toBe('zh-hant')

  process.env['LC_MESSAGES'] = 'en_US.UTF-8'
  expect(detectLocale()).toBe('en')

  process.env['LC_ALL'] = 'zh_CN.UTF-8'
  expect(detectLocale()).toBe('zh-hans')
})

test('detectLocale 归一化 POSIX 与 BCP 47 标签', () => {
  const cases: [string, string][] = [
    ['en_US.UTF-8', 'en'],
    ['zh_TW.UTF-8', 'zh-hant'],
    ['zh_TW@modifier', 'zh-hant'],
    ['zh-Hant-TW', 'zh-hant'],
    ['zh_HK', 'zh-hant'],
    ['zh_MO', 'zh-hant'],
    ['zh-Hans', 'zh-hans'],
    ['zh_SG', 'zh-hans'],
    ['zh', 'zh-hans'],
    ['en_GB', 'en'],
  ]

  for (const [raw, expected] of cases) {
    process.env['LANG'] = raw
    expect(detectLocale()).toBe(expected)
  }
})

test('detectLocale 跳过 C 与 POSIX 这类中性取值', () => {
  process.env['LC_ALL'] = 'C'
  process.env['LANG'] = 'zh_TW.UTF-8'
  // LC_ALL 是中性取值, 因此继续读到 LANG
  expect(detectLocale()).toBe('zh-hant')

  process.env['LC_MESSAGES'] = 'POSIX'
  expect(detectLocale()).toBe('zh-hant')
})

test('detectLocale 对不支持的语言回退到默认中文', () => {
  process.env['LANG'] = 'ja_JP.UTF-8'
  expect(detectLocale()).toBe(DEFAULT_LOCALE)
})

test('detectLocale 始终返回受支持的 locale', () => {
  expect(LOCALES).toContain(detectLocale())
  expect(resolveLanguage('auto')).toBe(detectLocale())
})

test('resolveLanguage 对具体语言原样返回, 不读取环境变量', () => {
  process.env['LANG'] = 'en_US.UTF-8'
  expect(resolveLanguage('zh-hant')).toBe('zh-hant')
  expect(resolveLanguage('zh-hans')).toBe('zh-hans')
  expect(resolveLanguage('auto')).toBe('en')
})

/* ---------- 插值与复数 ---------- */

test('t 替换 {name} 占位符, 缺参时保留原文', () => {
  expect(t('api.error.quote', { status: 500 })).toBe('行情接口请求失败: HTTP 500')
  expect(t('api.error.quote', {})).toBe('行情接口请求失败: HTTP {status}')
  expect(t('api.error.quote')).toBe('行情接口请求失败: HTTP {status}')
})

test('t 把数值参数转为字符串, 且 0 不被当作缺参', () => {
  expect(t('windowGuard.width', { value: 0 })).toBe('宽度 = 0')
  expect(t('stockList.remaining', { count: 0 })).toBe('剩余 0 个')
})

test('t 对无占位符的文案直接返回', () => {
  expect(t('menu.reset')).toBe('重置')
})

test('t 按 count 选择复数形态, count 非 1 时取 other', () => {
  const translate = createTranslator('en')
  expect(translate('stockAdd.saving', { count: 1 })).toBe('Adding 1 stock...')
  expect(translate('stockAdd.saving', { count: 2 })).toBe('Adding 2 stocks...')
  expect(translate('stockAdd.saving', { count: 0 })).toBe('Adding 0 stocks...')
  // 未传 count 时确定性地取 other, 不抛错
  expect(translate('stockAdd.saving')).toBe('Adding {count} stocks...')
})

test('t 对英文的复数键区分 one 与 other', () => {
  const translate = createTranslator('en')
  expect(translate('dialogRemoveConfirm.allMissing', { count: 1 })).toBe(
    '1 selected entry is no longer in the watchlist.',
  )
  expect(translate('dialogRemoveConfirm.allMissing', { count: 3 })).toBe(
    '3 selected entries are no longer in the watchlist.',
  )
})

test('t 忽略字符串型条目上的 count 参数', () => {
  expect(t('common.suspended', { count: 1 })).toBe('停牌')
})

/* ---------- active locale ---------- */

test('setActiveLocale 与 applyLanguage 切换全局翻译语言', () => {
  expect(getActiveLocale()).toBe('zh-hans')
  expect(t('menu.reset')).toBe('重置')

  setActiveLocale('en')
  expect(t('menu.reset')).toBe('Reset')

  expect(applyLanguage('zh-hant')).toBe('zh-hant')
  expect(getActiveLocale()).toBe('zh-hant')
  expect(t('menu.reset')).toBe('重設')
})

test('applyLanguage 解析 auto 并返回结果', () => {
  process.env['LANG'] = 'en_US.UTF-8'
  expect(applyLanguage('auto')).toBe('en')
  expect(getActiveLocale()).toBe('en')
})

test('createTranslator 绑定 locale, 不受 active locale 影响', () => {
  setActiveLocale('zh-hans')
  const translate = createTranslator('en')
  expect(translate('menu.reset')).toBe('Reset')
  expect(t('menu.reset')).toBe('重置')
})

/* ---------- catalog 一致性 ---------- */

const keysOf = <T extends object>(catalog: T) => Object.keys(catalog).toSorted() as (keyof T)[]

test('三种语言的 catalog 键集合完全一致', () => {
  const canonical = keysOf(CATALOGS['zh-hans'])
  expect(keysOf(CATALOGS['zh-hant'])).toStrictEqual(canonical)
  expect(keysOf(CATALOGS['en'])).toStrictEqual(canonical)
  expect(canonical.length).toBeGreaterThan(100)
})

test('CATALOGS 覆盖全部受支持 locale', () => {
  for (const locale of LOCALES) {
    expect(keysOf(CATALOGS[locale])).toStrictEqual(keysOf(CATALOGS['zh-hans']))
  }
})

test('所有 catalog 条目非空', () => {
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    for (const [key, value] of Object.entries(catalog)) {
      if (typeof value === 'string') {
        expect(value.length, `${locale} ${key}`).toBeGreaterThan(0)
      } else if (value) {
        expect(value.one.length, `${locale} ${key}.one`).toBeGreaterThan(0)
        expect(value.other.length, `${locale} ${key}.other`).toBeGreaterThan(0)
      }
    }
  }
})

/** 收集一条文案中出现的全部占位符 (复数条目合并两种形态) */
const placeholders = (value: MessageValue | undefined): string[] => {
  const templates = typeof value === 'string' ? [value] : value ? [value.one, value.other] : []
  return [
    ...new Set(templates.flatMap((template) => [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!))),
  ].toSorted()
}

test('同一键在各语言下的占位符集合一致', () => {
  for (const [key, value] of Object.entries(CATALOGS['zh-hans']) as [MessageKey, MessageValue][]) {
    const expected = placeholders(value)
    expect(placeholders(CATALOGS['zh-hant'][key]), `zh-hant ${key}`).toStrictEqual(expected)
    expect(placeholders(CATALOGS['en'][key]), `en ${key}`).toStrictEqual(expected)
  }
})

test('英文对需要单复数的计数文案提供两种不同形态', () => {
  // 中文没有单复数变化, 因此只在英文上断言
  let pluralKeys = 0
  for (const [key, value] of Object.entries(CATALOGS['en'])) {
    if (typeof value !== 'object') continue
    pluralKeys += 1
    expect(value.one, key).not.toBe(value.other)
  }
  expect(pluralKeys).toBeGreaterThan(0)
})

test('复数键的计数占位符命名为 count, 与形态选择的依据一致', () => {
  // pluralForm 只看 params.count: 若计数占位符另起别名 (如 {added}), 调用方就得额外传一个
  // 与显示值重复的 count, 漏传时会静默落到 other 而输出 "Removed 1 stocks".
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    for (const [key, value] of Object.entries(catalog)) {
      if (typeof value === 'string') continue
      for (const form of ['one', 'other'] as const) {
        expect(placeholders(value[form]), `${locale} ${key}.${form}`).toContain('count')
      }
    }
  }
})

/* ---------- 文案规范 ---------- */

test('catalog 不含全角标点, 顿号, U+3000 与 emoji', () => {
  // 中文全角标点, 顿号, 全角空格, 以及 emoji 与杂项符号
  const forbidden = /[、　！（），：；？～‘’“”]|[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    for (const [key, value] of Object.entries(catalog)) {
      const templates = typeof value === 'string' ? [value] : value ? [value.one, value.other] : []
      for (const template of templates) {
        expect(forbidden.test(template), `${locale} ${key}: ${template}`).toBe(false)
      }
    }
  }
})
