import { beforeEach, expect, test } from 'vitest'

import {
  DEFAULT_SETTINGS,
  type Settings,
  settingsEqual,
  settingsPatch,
  settingsSnapshot,
  useSettingsStore,
} from '../src/stores/useSettingsStore.ts'

beforeEach(() => {
  useSettingsStore.getState().resetSettings()
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
