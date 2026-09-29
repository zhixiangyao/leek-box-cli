import { expect, test } from 'vitest'

import { CATALOGS } from '../src/i18n/catalog/index.ts'
import { LOCALES } from '../src/i18n/locale.ts'
import type { MessageKey, MessageValue } from '../src/i18n/types.ts'

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
