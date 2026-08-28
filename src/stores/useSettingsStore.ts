import { TextProps } from 'ink'
import { create } from 'zustand'

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

export const TREND_COLOR_MODES = ['red-up', 'green-up'] as const

export type TrendColorMode = (typeof TREND_COLOR_MODES)[number]

export const TREND_COLOR_MODE_LABELS: Record<TrendColorMode, string> = {
  'red-up': '涨红跌绿',
  'green-up': '涨绿跌红',
}

export const DEFAULT_TREND_COLOR_MODE: TrendColorMode = 'red-up'

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

type SettingsState = Settings & {
  updateSettings: (patch: Partial<Settings>) => void
  adjustNumericSetting: (setting: NumericSettingKey, direction: 1 | -1) => void
  resetSettings: () => void
  hydrateSettings: (settings: Settings) => void
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)))

const normalizeSettings = (settings: Settings): Settings => {
  const requestTimeoutMs = clamp(
    settings.requestTimeoutMs,
    SETTING_LIMITS.requestTimeoutMs.min,
    SETTING_LIMITS.requestTimeoutMs.max,
  )
  return {
    ...settings,
    requestTimeoutMs,
    minimumRequestDurationMs: Math.min(
      requestTimeoutMs,
      clamp(
        settings.minimumRequestDurationMs,
        SETTING_LIMITS.minimumRequestDurationMs.min,
        SETTING_LIMITS.minimumRequestDurationMs.max,
      ),
    ),
    quotePollIntervalMs: clamp(
      settings.quotePollIntervalMs,
      SETTING_LIMITS.quotePollIntervalMs.min,
      SETTING_LIMITS.quotePollIntervalMs.max,
    ),
    minuteChartPollIntervalMs: clamp(
      settings.minuteChartPollIntervalMs,
      SETTING_LIMITS.minuteChartPollIntervalMs.min,
      SETTING_LIMITS.minuteChartPollIntervalMs.max,
    ),
    klinePollIntervalMs: clamp(
      settings.klinePollIntervalMs,
      SETTING_LIMITS.klinePollIntervalMs.min,
      SETTING_LIMITS.klinePollIntervalMs.max,
    ),
  }
}

export const settingsSnapshot = (settings: Settings): Settings => ({
  themePreset: settings.themePreset,
  trendColorMode: settings.trendColorMode,
  borderStyle: settings.borderStyle,
  requestTimeoutMs: settings.requestTimeoutMs,
  minimumRequestDurationMs: settings.minimumRequestDurationMs,
  quotePollIntervalMs: settings.quotePollIntervalMs,
  minuteChartPollIntervalMs: settings.minuteChartPollIntervalMs,
  klinePollIntervalMs: settings.klinePollIntervalMs,
})

export const settingsEqual = (left: Settings, right: Settings) =>
  left.themePreset === right.themePreset &&
  left.trendColorMode === right.trendColorMode &&
  left.borderStyle === right.borderStyle &&
  left.requestTimeoutMs === right.requestTimeoutMs &&
  left.minimumRequestDurationMs === right.minimumRequestDurationMs &&
  left.quotePollIntervalMs === right.quotePollIntervalMs &&
  left.minuteChartPollIntervalMs === right.minuteChartPollIntervalMs &&
  left.klinePollIntervalMs === right.klinePollIntervalMs

export const settingsPatch = (current: Settings, previous: Settings): Partial<Settings> => {
  const patch: Partial<Settings> = {}
  if (current.themePreset !== previous.themePreset) patch.themePreset = current.themePreset
  if (current.trendColorMode !== previous.trendColorMode) patch.trendColorMode = current.trendColorMode
  if (current.borderStyle !== previous.borderStyle) patch.borderStyle = current.borderStyle
  if (current.requestTimeoutMs !== previous.requestTimeoutMs) patch.requestTimeoutMs = current.requestTimeoutMs
  if (current.minimumRequestDurationMs !== previous.minimumRequestDurationMs) {
    patch.minimumRequestDurationMs = current.minimumRequestDurationMs
  }
  if (current.quotePollIntervalMs !== previous.quotePollIntervalMs) {
    patch.quotePollIntervalMs = current.quotePollIntervalMs
  }
  if (current.minuteChartPollIntervalMs !== previous.minuteChartPollIntervalMs) {
    patch.minuteChartPollIntervalMs = current.minuteChartPollIntervalMs
  }
  if (current.klinePollIntervalMs !== previous.klinePollIntervalMs) {
    patch.klinePollIntervalMs = current.klinePollIntervalMs
  }
  return patch
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  ...DEFAULT_SETTINGS,
  updateSettings: (patch) => set((state) => normalizeSettings({ ...settingsSnapshot(state), ...patch })),
  adjustNumericSetting: (setting, direction) =>
    set((state) => {
      const limits = SETTING_LIMITS[setting]
      const value = clamp(state[setting] + limits.step * direction, limits.min, limits.max)
      return normalizeSettings({ ...settingsSnapshot(state), [setting]: value })
    }),
  resetSettings: () => set(DEFAULT_SETTINGS),
  hydrateSettings: (settings) => set(normalizeSettings(settings)),
}))
