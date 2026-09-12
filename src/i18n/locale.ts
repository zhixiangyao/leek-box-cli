import process from 'node:process'

import type { Language, Locale } from './types.ts'

export const LOCALES = ['zh-hans', 'zh-hant', 'en'] as const

/** 无法从系统语言识别出受支持语言时的兜底 */
export const DEFAULT_LOCALE: Locale = 'zh-hans'

export const LANGUAGES = ['auto', ...LOCALES] as const

/** auto 表示跟随系统语言 */
export const DEFAULT_LANGUAGE: Language = 'auto'

/**
 * 各 locale 的母语名称.
 * 不随界面语言变化, 保证误切语言后仍能找回自己的语言.
 */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  'zh-hans': '简体中文',
  'zh-hant': '繁體中文',
  en: 'English',
}

/** 环境变量中不表示具体语言的中性取值 */
const NEUTRAL_LOCALES = ['c', 'posix']

/** POSIX 或 BCP 47 语言标签归一化: zh_TW.UTF-8@mod -> zh-tw */
const normalizeTag = (tag: string): string => {
  const withoutModifier = tag.split('@')[0] ?? ''
  const withoutEncoding = withoutModifier.split('.')[0] ?? ''
  return withoutEncoding.replaceAll('_', '-').toLowerCase()
}

/** 按语言标签匹配受支持的 locale, 无法匹配时返回 undefined */
const matchLocale = (tag: string): Locale | undefined => {
  const subtags = tag.split('-')
  const language = subtags[0]
  if (language === 'zh') {
    const traditional = subtags.some((subtag) => ['tw', 'hk', 'mo', 'hant'].includes(subtag))
    return traditional ? 'zh-hant' : 'zh-hans'
  }
  if (language === 'en') return 'en'
  return undefined
}

/**
 * 按 LC_ALL > LC_MESSAGES > LANG 读取语言标签, 跳过 C 和 POSIX 这类中性取值.
 * 明确指定了受支持语言就立即采用; 明确指定了不支持的语言 (如 ja_JP) 按默认语言处理,
 * 不再回退到 Intl: 环境变量比系统默认值更能代表用户意图.
 */
const localeFromEnvironment = (): Locale | undefined => {
  for (const name of ['LC_ALL', 'LC_MESSAGES', 'LANG']) {
    const raw = process.env[name]
    if (!raw) continue
    const tag = normalizeTag(raw)
    if (tag === '' || NEUTRAL_LOCALES.includes(tag)) continue
    return matchLocale(tag) ?? DEFAULT_LOCALE
  }
  return undefined
}

/** 读取 Node 解析出的系统 locale, Windows 下这是唯一的可用来源 */
const localeFromIntl = (): Locale | undefined => {
  try {
    return matchLocale(normalizeTag(Intl.DateTimeFormat().resolvedOptions().locale))
  } catch {
    return undefined
  }
}

/** 检测系统语言, 每次调用实时计算以便测试替换环境变量 */
export const detectLocale = (): Locale => localeFromEnvironment() ?? localeFromIntl() ?? DEFAULT_LOCALE

/** 将语言设置解析为具体 locale */
export const resolveLanguage = (language: Language): Locale => (language === 'auto' ? detectLocale() : language)
