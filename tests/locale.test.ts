import { afterEach, beforeEach, expect, test } from 'vitest'

import { setActiveLocale } from '../src/i18n/core.ts'
import { DEFAULT_LOCALE, detectLocale, LOCALES, resolveLanguage } from '../src/i18n/locale.ts'

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
