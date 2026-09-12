import { TextProps } from 'ink'

import { t } from '../i18n/core.ts'
import { DEFAULT_LANGUAGE, LANGUAGES } from '../i18n/locale.ts'
import type { Language } from '../i18n/types.ts'
import { DEFAULT_TREND_COLOR_MODE, TREND_COLOR_MODES, type TrendColorMode } from '../lib/format.ts'
import { isNormalObject } from '../lib/is.ts'

/* ---------- 外观 (theme / border) ---------- */

export const BORDER_STYLES = [
  'single',
  'double',
  'round',
  'bold',
  'singleDouble',
  'doubleSingle',
  'classic',
  'arrow',
] as const

/** 显示名称在 i18n catalog 的 settings.borderStyle.*, 由 useSettings 的 Record 保证一一对应 */
export type BorderStyle = (typeof BORDER_STYLES)[number]

export type Color = TextProps['color']

export type ThemePreset = 'classic' | 'gray' | 'ocean' | 'forest' | 'sunset'

/** 主题只定义色值, 显示名称在 i18n catalog 的 settings.themePreset.* */
export type ThemePalette = {
  primary: Color
  accent: Color
  highlight: Color
  foreground: Color
}

export const THEME_PRESETS = {
  classic: {
    primary: 'magenta',
    accent: 'blue',
    highlight: 'cyan',
    foreground: 'white',
  },
  ocean: {
    primary: 'cyan',
    accent: 'blue',
    highlight: 'cyan',
    foreground: 'white',
  },
  forest: {
    primary: 'green',
    accent: 'green',
    highlight: 'green',
    foreground: 'white',
  },
  sunset: {
    primary: 'yellow',
    accent: 'red',
    highlight: 'yellow',
    foreground: 'white',
  },
  gray: {
    primary: 'gray',
    accent: 'gray',
    highlight: 'gray',
    foreground: 'white',
  },
} satisfies Record<ThemePreset, ThemePalette>

export const THEME_PRESET_NAMES = Object.keys(THEME_PRESETS) as ThemePreset[]

/* ---------- 应用设置 ---------- */

export const SETTING_LIMITS = {
  requestTimeoutMs: { min: 1000, max: 60_000, step: 1000 },
  minimumRequestDurationMs: { min: 0, max: 5000, step: 250 },
  quotePollIntervalMs: { min: 1000, max: 60_000, step: 500 },
  minuteChartPollIntervalMs: { min: 5000, max: 5 * 60_000, step: 5000 },
  klinePollIntervalMs: { min: 30_000, max: 30 * 60_000, step: 30_000 },
} as const

export type NumericSettingKey = keyof typeof SETTING_LIMITS

export type Settings = {
  themePreset: ThemePreset
  trendColorMode: TrendColorMode
  borderStyle: BorderStyle
  language: Language
  requestTimeoutMs: number
  minimumRequestDurationMs: number
  quotePollIntervalMs: number
  minuteChartPollIntervalMs: number
  klinePollIntervalMs: number
}

export const DEFAULT_SETTINGS: Settings = {
  themePreset: 'classic',
  trendColorMode: DEFAULT_TREND_COLOR_MODE,
  borderStyle: 'round',
  language: DEFAULT_LANGUAGE,
  requestTimeoutMs: 8000,
  minimumRequestDurationMs: 0,
  quotePollIntervalMs: 5000,
  minuteChartPollIntervalMs: 30_000,
  klinePollIntervalMs: 5 * 60_000,
}

/* ---------- 持久化文档 ---------- */

export type StockEntry = {
  /** 股票代码 */
  code: string
  /** 股票名称 */
  name: string
  /** 添加时间(ISO 时间) */
  addedAt: string
}

export type SettingsDocument = {
  /** 界面语言, auto 表示跟随系统 */
  language: Language
  theme: {
    preset: Settings['themePreset']
    trendColorMode: Settings['trendColorMode']
    borderStyle: Settings['borderStyle']
  }
  request: {
    timeoutMs: number
    minimumDurationMs: number
    quotePollIntervalMs: number
    minuteChartPollIntervalMs: number
    klinePollIntervalMs: number
  }
  stocks: StockEntry[]
}

const WATCH_CODE_PATTERN = /^(?:sh|sz|bj)\d{6}$/

/** 解析并验证单个股票条目 */
const parseStock = (value: unknown, index: number): StockEntry => {
  if (typeof value !== 'object' || value === null)
    throw new Error(t('settings.error.stockNotObject', { index: index + 1 }))
  const entry = value as Record<string, unknown>
  if (typeof entry['code'] !== 'string' || !WATCH_CODE_PATTERN.test(entry['code'])) {
    throw new Error(t('settings.error.stockCode', { index: index + 1 }))
  }
  if (typeof entry['name'] !== 'string' || entry['name'].trim() === '') {
    throw new Error(t('settings.error.stockName', { index: index + 1 }))
  }
  if (typeof entry['addedAt'] !== 'string' || !Number.isFinite(Date.parse(entry['addedAt']))) {
    throw new Error(t('settings.error.stockAddedAt', { index: index + 1 }))
  }
  return { code: entry['code'], name: entry['name'], addedAt: entry['addedAt'] }
}

/** 解析并验证股票条目列表 */
export function parseStocks(value: unknown): StockEntry[] {
  if (!Array.isArray(value)) throw new Error(t('settings.error.stocksNotArray'))
  const entries = value.map(parseStock)
  const seen = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.code)) {
      throw new Error(t('settings.error.stockCodeDuplicate', { index: index + 1, code: entry.code }))
    }
    seen.add(entry.code)
  }
  return entries
}

/** 验证主题预设名称 */
const parseThemePreset = (value: unknown): ThemePreset => {
  if (typeof value !== 'string' || !THEME_PRESET_NAMES.includes(value as ThemePreset)) {
    throw new Error(t('settings.error.themePreset'))
  }
  return value as ThemePreset
}

/** 验证涨跌颜色模式 */
const parseTrendColorMode = (value: unknown): TrendColorMode => {
  if (value === undefined) return DEFAULT_TREND_COLOR_MODE
  if (typeof value !== 'string' || !TREND_COLOR_MODES.includes(value as TrendColorMode)) {
    throw new Error(t('settings.error.trendColorMode'))
  }
  return value as TrendColorMode
}

/** 验证界面语言设置, 缺失时按默认 auto 接受 */
const parseLanguage = (value: unknown): Language => {
  if (value === undefined) return DEFAULT_LANGUAGE
  if (typeof value !== 'string' || !LANGUAGES.includes(value as Language)) {
    throw new Error(t('settings.error.language'))
  }
  return value as Language
}

/** 验证范围内的整数配置值 */
const parseInteger = (value: unknown, name: string, limits: { min: number; max: number }) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < limits.min || value > limits.max) {
    throw new Error(t('settings.error.invalidValue', { name }))
  }
  return value
}

/** 解析并验证完整设置文档 */
export function parseSettingsDocument(value: unknown): SettingsDocument {
  if (!isNormalObject(value)) throw new Error(t('settings.error.notObject'))

  const theme = value['theme']
  if (!isNormalObject(theme)) throw new Error(t('settings.error.theme'))
  const borderStyle = theme['borderStyle']
  if (typeof borderStyle !== 'string' || !BORDER_STYLES.includes(borderStyle as Settings['borderStyle'])) {
    throw new Error(t('settings.error.borderStyle'))
  }

  const request = value['request']
  if (!isNormalObject(request)) throw new Error(t('settings.error.request'))
  const timeoutMs = parseInteger(request['timeoutMs'], 'request.timeoutMs', SETTING_LIMITS.requestTimeoutMs)
  const minimumDurationMs = parseInteger(
    request['minimumDurationMs'],
    'request.minimumDurationMs',
    SETTING_LIMITS.minimumRequestDurationMs,
  )
  if (minimumDurationMs > timeoutMs) throw new Error(t('settings.error.minimumDurationGtTimeout'))

  return {
    language: parseLanguage(value['language']),
    theme: {
      preset: parseThemePreset(theme['preset']),
      trendColorMode: parseTrendColorMode(theme['trendColorMode']),
      borderStyle: borderStyle as Settings['borderStyle'],
    },
    request: {
      timeoutMs,
      minimumDurationMs,
      quotePollIntervalMs: parseInteger(
        request['quotePollIntervalMs'],
        'request.quotePollIntervalMs',
        SETTING_LIMITS.quotePollIntervalMs,
      ),
      minuteChartPollIntervalMs: parseInteger(
        request['minuteChartPollIntervalMs'],
        'request.minuteChartPollIntervalMs',
        SETTING_LIMITS.minuteChartPollIntervalMs,
      ),
      klinePollIntervalMs: parseInteger(
        request['klinePollIntervalMs'],
        'request.klinePollIntervalMs',
        SETTING_LIMITS.klinePollIntervalMs,
      ),
    },
    stocks: parseStocks(value['stocks']),
  }
}

/** 将设置文档转换为应用设置 */
export function settingsFromDocument(document: SettingsDocument): Settings {
  return {
    themePreset: document.theme.preset,
    trendColorMode: document.theme.trendColorMode,
    borderStyle: document.theme.borderStyle,
    language: document.language,
    requestTimeoutMs: document.request.timeoutMs,
    minimumRequestDurationMs: document.request.minimumDurationMs,
    quotePollIntervalMs: document.request.quotePollIntervalMs,
    minuteChartPollIntervalMs: document.request.minuteChartPollIntervalMs,
    klinePollIntervalMs: document.request.klinePollIntervalMs,
  }
}

/** 组合应用设置和股票条目为持久化文档 */
export function createDocument(settings: Settings, stocks: StockEntry[]): SettingsDocument {
  return {
    language: settings.language,
    theme: {
      preset: settings.themePreset,
      trendColorMode: settings.trendColorMode,
      borderStyle: settings.borderStyle,
    },
    request: {
      timeoutMs: settings.requestTimeoutMs,
      minimumDurationMs: settings.minimumRequestDurationMs,
      quotePollIntervalMs: settings.quotePollIntervalMs,
      minuteChartPollIntervalMs: settings.minuteChartPollIntervalMs,
      klinePollIntervalMs: settings.klinePollIntervalMs,
    },
    stocks,
  }
}
