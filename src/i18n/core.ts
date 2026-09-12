import { CATALOGS } from './catalog/index.ts'
import { DEFAULT_LOCALE, resolveLanguage } from './locale.ts'
import type { MessageKey, MessageParams, Translate, Locale, Language } from './types.ts'

const PLACEHOLDER = /\{(\w+)\}/g

/** 替换 {name} 占位符, 缺少参数时保留原文以便发现遗漏 */
const interpolate = (template: string, params?: MessageParams): string => {
  if (params === undefined) return template
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

/** 计数形态: 只有 count 恰好为 1 时用 one */
const pluralForm = (params?: MessageParams): 'one' | 'other' => (params?.['count'] === 1 ? 'one' : 'other')

const translateWith = (locale: Locale, key: MessageKey, params?: MessageParams): string => {
  const value = CATALOGS[locale][key] ?? CATALOGS[DEFAULT_LOCALE][key]
  if (value === undefined) return key
  const template = typeof value === 'string' ? value : (value[pluralForm(params)] ?? value.other)
  return interpolate(template, params)
}

/**
 * 当前生效的 locale. 由 settings 的 language 派生, 不是独立状态:
 * 生产只由 parseCli 预读文档后的 applyLanguage 和 settingsPersistence 的 hydrate/订阅写入,
 * setActiveLocale 只给测试固定语言用.
 * 初始值是常量而不是检测结果, 因此默认中文, 且测试不受运行环境语言影响.
 */
let activeLocale: Locale = DEFAULT_LOCALE

export const getActiveLocale = (): Locale => activeLocale

export const setActiveLocale = (locale: Locale): void => {
  activeLocale = locale
}

/** 解析语言设置并使其立即生效, 返回解析结果 */
export const applyLanguage = (language: Language): Locale => {
  activeLocale = resolveLanguage(language)
  return activeLocale
}

/** 生成绑定到指定 locale 的翻译函数 */
export const createTranslator = (locale: Locale): Translate => {
  return (key, params) => translateWith(locale, key, params)
}

/** 绑定到当前生效 locale 的翻译函数, 供 store 与纯函数层使用 */
export const t: Translate = (key, params) => translateWith(activeLocale, key, params)
