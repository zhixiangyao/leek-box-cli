import { create } from 'zustand'

import { DEFAULT_SETTINGS, type NumericSettingKey, type Settings, SETTING_LIMITS } from '../settings/schema.ts'

type SettingsState = Settings & {
  updateSettings: (patch: Partial<Settings>) => void
  adjustNumericSetting: (setting: NumericSettingKey, direction: 1 | -1) => void
  resetSettings: () => void
  hydrateSettings: (settings: Settings) => void
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
