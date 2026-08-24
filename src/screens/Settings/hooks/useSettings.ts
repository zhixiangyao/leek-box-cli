import { useInput } from 'ink'
import { useState } from 'react'

import { useOverlayOpen } from '../../../hooks/useOverlayOpen.ts'
import {
  BORDER_STYLES,
  type NumericSettingKey,
  THEME_PRESET_NAMES,
  THEME_PRESETS,
  useSettingsStore,
} from '../../../stores/useSettingsStore.ts'

type SettingItem =
  | { type: 'theme'; label: string }
  | { type: 'border'; label: string }
  | { type: 'numeric'; label: string; setting: NumericSettingKey }

const SETTING_ITEMS: SettingItem[] = [
  { type: 'theme', label: '主题色系' },
  { type: 'border', label: '卡片边框' },
  { type: 'numeric', label: '请求超时', setting: 'requestTimeoutMs' },
  { type: 'numeric', label: '请求最短耗时', setting: 'minimumRequestDurationMs' },
  { type: 'numeric', label: '行情刷新间隔', setting: 'quotePollIntervalMs' },
  { type: 'numeric', label: '分时图刷新间隔', setting: 'minuteChartPollIntervalMs' },
  { type: 'numeric', label: 'K 线刷新间隔', setting: 'klinePollIntervalMs' },
]

const nextOption = <Value extends string>(options: readonly Value[], current: Value, direction: 1 | -1) => {
  const currentIndex = options.indexOf(current)
  return options[(currentIndex + direction + options.length) % options.length] ?? current
}

const formatDuration = (milliseconds: number) => {
  if (milliseconds === 0) return '关闭'
  if (milliseconds < 1000) return `${milliseconds} ms`
  if (milliseconds % 60_000 === 0) return `${milliseconds / 60_000} 分钟`
  if (milliseconds % 1000 === 0) return `${milliseconds / 1000} 秒`
  return `${(milliseconds / 1000).toFixed(2)} 秒`
}

export function useSettings() {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const overlayOpen = useOverlayOpen()
  const settings = useSettingsStore()

  const adjustSelected = (direction: 1 | -1) => {
    const selected = SETTING_ITEMS[selectedIndex]
    if (!selected) return

    if (selected.type === 'theme') {
      settings.updateSettings({
        themePreset: nextOption(THEME_PRESET_NAMES, settings.themePreset, direction),
      })
    } else if (selected.type === 'border') {
      settings.updateSettings({
        borderStyle: nextOption(BORDER_STYLES, settings.borderStyle, direction),
      })
    } else {
      settings.adjustNumericSetting(selected.setting, direction)
    }
  }

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (key.upArrow) {
        setSelectedIndex((current) => (current - 1 + SETTING_ITEMS.length) % SETTING_ITEMS.length)
      } else if (key.downArrow) {
        setSelectedIndex((current) => (current + 1) % SETTING_ITEMS.length)
      } else if (key.leftArrow) {
        adjustSelected(-1)
      } else if (key.rightArrow || key.return) {
        adjustSelected(1)
      } else if (input === 'd') {
        settings.resetSettings()
      }
    },
    { isActive: !overlayOpen },
  )

  const rows = SETTING_ITEMS.map((item, index) => ({
    label: item.label,
    selected: index === selectedIndex,
    value:
      item.type === 'theme'
        ? THEME_PRESETS[settings.themePreset].label
        : item.type === 'border'
          ? settings.borderStyle
          : formatDuration(settings[item.setting]),
  }))

  return {
    overlayOpen,
    appearanceItems: rows.slice(0, 2),
    requestItems: rows.slice(2),
  }
}
