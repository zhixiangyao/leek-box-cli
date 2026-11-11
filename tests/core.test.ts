import { afterEach, beforeEach, expect, test } from 'vitest'

import { CATALOGS } from '../src/i18n/catalog/index.ts'
import { applyLanguage, createTranslator, getActiveLocale, setActiveLocale, t } from '../src/i18n/core.ts'
import { DEFAULT_LOCALE } from '../src/i18n/locale.ts'
import type { MessageKey } from '../src/i18n/types.ts'

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

/* ---------- 插值与复数 ---------- */

test('t 替换 {name} 占位符, 缺参时保留原文', () => {
  expect(t('api.error.quote', { status: 500 })).toBe('行情接口请求失败: HTTP 500')
  expect(t('api.error.quote', {})).toBe('行情接口请求失败: HTTP {status}')
  expect(t('api.error.quote')).toBe('行情接口请求失败: HTTP {status}')
})

test('t 把数值参数转为字符串, 且 0 不被当作缺参', () => {
  expect(t('windowGuard.width', { value: 0 })).toBe('宽度 = 0')
  expect(t('dialogRemoveConfirm.allMissing', { count: 0 })).toBe('所选 0 个条目已不在自选股中.')
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

test('当前语言的文案缺失时回退默认语言, 两边都没有时返回键名', () => {
  const english = CATALOGS.en as unknown as Record<string, unknown>
  const savedReset = english['menu.reset'] as string
  const savedSaving = english['stockAdd.saving'] as { one: string; other: string }

  try {
    delete english['menu.reset']
    expect(createTranslator('en')('menu.reset')).toBe(t('menu.reset'))

    // 复数形态缺失时回退 other
    english['stockAdd.saving'] = { other: savedSaving.other }
    expect(createTranslator('en')('stockAdd.saving', { count: 1 })).toBe(savedSaving.other.replace('{count}', '1'))

    expect(createTranslator('en')('missing.key' as MessageKey)).toBe('missing.key')
  } finally {
    english['menu.reset'] = savedReset
    english['stockAdd.saving'] = savedSaving
  }
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
