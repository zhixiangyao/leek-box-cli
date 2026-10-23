import { beforeEach, expect, test } from 'vitest'

import { DEFAULT_SETTINGS, type NumericSettingKey, SETTING_LIMITS, type Settings } from '../src/settings/schema.ts'
import { settingsEqual, settingsPatch, settingsSnapshot, useSettingsStore } from '../src/stores/useSettingsStore.ts'

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]

/** 构造与默认值不同的值: 数值 +1, 其余追加后缀. 只用于比较函数, 不要求是合法设置值 */
const differentValue = (value: Settings[keyof Settings]) => (typeof value === 'number' ? value + 1 : `${value}-changed`)

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true)
})

test('settingsSnapshot 提取纯数据字段, 不含方法', () => {
  const snapshot = settingsSnapshot(useSettingsStore.getState())
  expect(snapshot).toStrictEqual(DEFAULT_SETTINGS)
  expect('updateSettings' in snapshot).toBe(false)
})

test('settingsEqual 逐字段比较设置', () => {
  const base = { ...DEFAULT_SETTINGS }
  expect(settingsEqual(base, { ...base })).toBe(true)
  expect(settingsEqual(base, { ...base, quotePollIntervalMs: base.quotePollIntervalMs + 500 })).toBe(false)
})

test('settingsPatch 仅返回发生变化的字段', () => {
  const previous: Settings = { ...DEFAULT_SETTINGS }
  const current: Settings = { ...previous, themePreset: 'ocean', quotePollIntervalMs: 6000 }
  expect(settingsPatch(current, previous)).toStrictEqual({ themePreset: 'ocean', quotePollIntervalMs: 6000 })
  expect(settingsPatch(previous, previous)).toStrictEqual({})
})

test('settingsEqual 与 settingsPatch 覆盖 Settings 的全部字段', () => {
  for (const key of SETTING_KEYS) {
    const changed = { ...DEFAULT_SETTINGS, [key]: differentValue(DEFAULT_SETTINGS[key]) } as Settings
    expect(settingsEqual(DEFAULT_SETTINGS, changed), key).toBe(false)
    expect(settingsPatch(changed, DEFAULT_SETTINGS), key).toStrictEqual({ [key]: changed[key] })
  }
})

test('每个数值设置都有边界, 且 hydrateSettings 会钳制越界值', () => {
  const numericKeys = SETTING_KEYS.filter((key) => typeof DEFAULT_SETTINGS[key] === 'number')
  expect([...numericKeys].sort()).toStrictEqual(Object.keys(SETTING_LIMITS).sort())

  for (const key of Object.keys(SETTING_LIMITS) as NumericSettingKey[]) {
    const limits = SETTING_LIMITS[key]
    useSettingsStore.getState().hydrateSettings({ ...DEFAULT_SETTINGS, [key]: limits.max + 1 })
    expect(useSettingsStore.getState()[key], `${key} 上界`).toBe(limits.max)

    useSettingsStore.getState().hydrateSettings({ ...DEFAULT_SETTINGS, [key]: limits.min - 1 })
    expect(useSettingsStore.getState()[key], `${key} 下界`).toBe(limits.min)
  }
})

test('adjustNumericSetting 按步长调整并钳制到区间边界', () => {
  const store = useSettingsStore.getState()
  store.adjustNumericSetting('requestTimeoutMs', 1)
  expect(useSettingsStore.getState().requestTimeoutMs).toBe(DEFAULT_SETTINGS.requestTimeoutMs + 1000)

  // quotePollIntervalMs 默认 5000, 下限 1000, 连续下调不会越界
  for (let i = 0; i < 20; i++) useSettingsStore.getState().adjustNumericSetting('quotePollIntervalMs', -1)
  expect(useSettingsStore.getState().quotePollIntervalMs).toBe(1000)
})

test('hydrateSettings 将越界值钳制回合法区间', () => {
  useSettingsStore.getState().hydrateSettings({
    ...DEFAULT_SETTINGS,
    requestTimeoutMs: 999_999,
    minimumRequestDurationMs: 999_999,
    quotePollIntervalMs: 0,
  })
  const state = useSettingsStore.getState()
  expect(state.requestTimeoutMs).toBe(60_000)
  expect(state.minimumRequestDurationMs).toBe(5000)
  expect(state.quotePollIntervalMs).toBe(1000)
})

test('hydrateSettings 保证最小请求时长不超过请求超时', () => {
  useSettingsStore.getState().hydrateSettings({
    ...DEFAULT_SETTINGS,
    requestTimeoutMs: 1000,
    minimumRequestDurationMs: 5000,
  })
  expect(useSettingsStore.getState().minimumRequestDurationMs).toBe(1000)
})

test('resetSettings 恢复默认设置', () => {
  useSettingsStore.getState().updateSettings({ themePreset: 'forest', borderStyle: 'double' })
  useSettingsStore.getState().resetSettings()
  expect(settingsSnapshot(useSettingsStore.getState())).toStrictEqual(DEFAULT_SETTINGS)
})
