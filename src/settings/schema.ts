import { TextProps } from 'ink'

import { DEFAULT_TREND_COLOR_MODE, TREND_COLOR_MODES, type TrendColorMode } from '../lib/format.ts'

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

export type BorderStyle = (typeof BORDER_STYLES)[number]

export type Color = TextProps['color']

export type ThemePreset = 'classic' | 'gray' | 'ocean' | 'forest' | 'sunset'

export type ThemePalette = {
  label: string
  primary: Color
  accent: Color
  highlight: Color
  foreground: Color
}

export const THEME_PRESETS = {
  classic: {
    label: '经典紫蓝',
    primary: 'magenta',
    accent: 'blue',
    highlight: 'cyan',
    foreground: 'white',
  },
  ocean: {
    label: '海洋青蓝',
    primary: 'cyan',
    accent: 'blue',
    highlight: 'cyan',
    foreground: 'white',
  },
  forest: {
    label: '森林绿',
    primary: 'green',
    accent: 'green',
    highlight: 'green',
    foreground: 'white',
  },
  sunset: {
    label: '日落黄红',
    primary: 'yellow',
    accent: 'red',
    highlight: 'yellow',
    foreground: 'white',
  },
  gray: {
    label: '低调灰',
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
  if (typeof value !== 'object' || value === null) throw new Error(`第 ${index + 1} 项不是对象`)
  const entry = value as Record<string, unknown>
  if (typeof entry['code'] !== 'string' || !WATCH_CODE_PATTERN.test(entry['code'])) {
    throw new Error(`第 ${index + 1} 项 code 无效`)
  }
  if (typeof entry['name'] !== 'string' || entry['name'].trim() === '') {
    throw new Error(`第 ${index + 1} 项 name 无效`)
  }
  if (typeof entry['addedAt'] !== 'string' || !Number.isFinite(Date.parse(entry['addedAt']))) {
    throw new Error(`第 ${index + 1} 项 addedAt 无效`)
  }
  return { code: entry['code'], name: entry['name'], addedAt: entry['addedAt'] }
}

/** 解析并验证股票条目列表 */
export function parseStocks(value: unknown): StockEntry[] {
  if (!Array.isArray(value)) throw new Error('stocks 不是数组')
  const entries = value.map(parseStock)
  const seen = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.code)) throw new Error(`第 ${index + 1} 项 code 重复: ${entry.code}`)
    seen.add(entry.code)
  }
  return entries
}

/** 判断值是否为普通对象 */
const isNormalObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 验证主题预设名称 */
const parseThemePreset = (value: unknown): ThemePreset => {
  if (typeof value !== 'string' || !THEME_PRESET_NAMES.includes(value as ThemePreset)) {
    throw new Error('theme.preset 无效')
  }
  return value as ThemePreset
}

/** 验证涨跌颜色模式 */
const parseTrendColorMode = (value: unknown): TrendColorMode => {
  if (value === undefined) return DEFAULT_TREND_COLOR_MODE
  if (typeof value !== 'string' || !TREND_COLOR_MODES.includes(value as TrendColorMode)) {
    throw new Error('theme.trendColorMode 无效')
  }
  return value as TrendColorMode
}

/** 验证范围内的整数配置值 */
const parseInteger = (value: unknown, name: string, limits: { min: number; max: number }) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < limits.min || value > limits.max) {
    throw new Error(`${name} 无效`)
  }
  return value
}

/** 解析并验证完整设置文档 */
export function parseSettingsDocument(value: unknown): SettingsDocument {
  if (!isNormalObject(value)) throw new Error('顶层数据不是对象')

  const theme = value['theme']
  if (!isNormalObject(theme)) throw new Error('theme 无效')
  const borderStyle = theme['borderStyle']
  if (typeof borderStyle !== 'string' || !BORDER_STYLES.includes(borderStyle as Settings['borderStyle'])) {
    throw new Error('theme.borderStyle 无效')
  }

  const request = value['request']
  if (!isNormalObject(request)) throw new Error('request 无效')
  const timeoutMs = parseInteger(request['timeoutMs'], 'request.timeoutMs', SETTING_LIMITS.requestTimeoutMs)
  const minimumDurationMs = parseInteger(
    request['minimumDurationMs'],
    'request.minimumDurationMs',
    SETTING_LIMITS.minimumRequestDurationMs,
  )
  if (minimumDurationMs > timeoutMs) throw new Error('request.minimumDurationMs 不能大于 request.timeoutMs')

  return {
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
