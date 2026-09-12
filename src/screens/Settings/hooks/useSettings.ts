import { useInput } from 'ink'
import { useState } from 'react'

import { useOverlayOpen } from '../../../hooks/useOverlayOpen.ts'
import { useTranslation } from '../../../hooks/useTranslation.ts'
import { LANGUAGES, LOCALE_NATIVE_NAMES } from '../../../i18n/locale.ts'
import type { MessageKey, Translate } from '../../../i18n/types.ts'
import { TREND_COLOR_MODES, type TrendColorMode } from '../../../lib/format.ts'
import { BORDER_STYLES, THEME_PRESET_NAMES } from '../../../settings/schema.ts'
import type { BorderStyle, NumericSettingKey, ThemePreset } from '../../../settings/schema.ts'
import { useSettingsStore } from '../../../stores/useSettingsStore.ts'

export type SettingRow = {
  label: string
  description: string
  value: string
  selected: boolean
}

type SettingGroup = 'appearance' | 'request'

/** type 必须是每个成员各一个字面量, 否则 TS 无法按它收窄 setting 字段 */
type SettingItem = {
  group: SettingGroup
  label: MessageKey
  description: MessageKey
} & (
  | { type: 'theme' }
  | { type: 'trendColor' }
  | { type: 'border' }
  | { type: 'language' }
  | { type: 'numeric'; setting: NumericSettingKey }
)

const SETTING_ITEMS: SettingItem[] = [
  {
    type: 'theme',
    group: 'appearance',
    label: 'settings.row.theme.label',
    description: 'settings.row.theme.description',
  },
  {
    type: 'trendColor',
    group: 'appearance',
    label: 'settings.row.trendColor.label',
    description: 'settings.row.trendColor.description',
  },
  {
    type: 'border',
    group: 'appearance',
    label: 'settings.row.border.label',
    description: 'settings.row.border.description',
  },
  {
    type: 'language',
    group: 'appearance',
    label: 'settings.row.language.label',
    description: 'settings.row.language.description',
  },
  {
    type: 'numeric',
    group: 'request',
    label: 'settings.row.requestTimeout.label',
    description: 'settings.row.requestTimeout.description',
    setting: 'requestTimeoutMs',
  },
  {
    type: 'numeric',
    group: 'request',
    label: 'settings.row.minimumDuration.label',
    description: 'settings.row.minimumDuration.description',
    setting: 'minimumRequestDurationMs',
  },
  {
    type: 'numeric',
    group: 'request',
    label: 'settings.row.quotePoll.label',
    description: 'settings.row.quotePoll.description',
    setting: 'quotePollIntervalMs',
  },
  {
    type: 'numeric',
    group: 'request',
    label: 'settings.row.minuteChartPoll.label',
    description: 'settings.row.minuteChartPoll.description',
    setting: 'minuteChartPollIntervalMs',
  },
  {
    type: 'numeric',
    group: 'request',
    label: 'settings.row.klinePoll.label',
    description: 'settings.row.klinePoll.description',
    setting: 'klinePollIntervalMs',
  },
]

const THEME_PRESET_KEYS: Record<ThemePreset, MessageKey> = {
  classic: 'settings.themePreset.classic',
  ocean: 'settings.themePreset.ocean',
  forest: 'settings.themePreset.forest',
  sunset: 'settings.themePreset.sunset',
  gray: 'settings.themePreset.gray',
}

const TREND_COLOR_MODE_KEYS: Record<TrendColorMode, MessageKey> = {
  'red-up': 'settings.trendColorMode.redUp',
  'green-up': 'settings.trendColorMode.greenUp',
}

/** Record<BorderStyle, ...> 保证新增边框样式时必然补上文案键 */
const BORDER_STYLE_KEYS: Record<BorderStyle, MessageKey> = {
  single: 'settings.borderStyle.single',
  double: 'settings.borderStyle.double',
  round: 'settings.borderStyle.round',
  bold: 'settings.borderStyle.bold',
  singleDouble: 'settings.borderStyle.singleDouble',
  doubleSingle: 'settings.borderStyle.doubleSingle',
  classic: 'settings.borderStyle.classic',
  arrow: 'settings.borderStyle.arrow',
}

const nextOption = <Value extends string>(options: readonly Value[], current: Value, direction: 1 | -1) => {
  const currentIndex = options.indexOf(current)
  return options[(currentIndex + direction + options.length) % options.length] ?? current
}

const formatDuration = (milliseconds: number, t: Translate) => {
  if (milliseconds === 0) return t('settings.duration.off')
  if (milliseconds < 1000) return t('settings.duration.rawMs', { value: milliseconds })
  if (milliseconds % 60_000 === 0) return t('settings.duration.minutes', { value: milliseconds / 60_000 })
  if (milliseconds % 1000 === 0) return t('settings.duration.seconds', { value: milliseconds / 1000 })
  return t('settings.duration.seconds', { value: (milliseconds / 1000).toFixed(2) })
}

export function useSettings() {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const overlayOpen = useOverlayOpen()
  const { locale, t } = useTranslation()
  const themePreset = useSettingsStore((state) => state.themePreset)
  const trendColorMode = useSettingsStore((state) => state.trendColorMode)
  const borderStyle = useSettingsStore((state) => state.borderStyle)
  const language = useSettingsStore((state) => state.language)
  const requestTimeoutMs = useSettingsStore((state) => state.requestTimeoutMs)
  const minimumRequestDurationMs = useSettingsStore((state) => state.minimumRequestDurationMs)
  const quotePollIntervalMs = useSettingsStore((state) => state.quotePollIntervalMs)
  const minuteChartPollIntervalMs = useSettingsStore((state) => state.minuteChartPollIntervalMs)
  const klinePollIntervalMs = useSettingsStore((state) => state.klinePollIntervalMs)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const adjustNumericSetting = useSettingsStore((state) => state.adjustNumericSetting)
  const resetSettings = useSettingsStore((state) => state.resetSettings)

  /** 数值项按 setting 键取值, 与 SETTING_ITEMS 的 setting 字段一一对应 */
  const numericValues: Record<NumericSettingKey, number> = {
    requestTimeoutMs,
    minimumRequestDurationMs,
    quotePollIntervalMs,
    minuteChartPollIntervalMs,
    klinePollIntervalMs,
  }

  const adjustSelected = (direction: 1 | -1) => {
    const selected = SETTING_ITEMS[selectedIndex]
    if (!selected) return

    if (selected.type === 'theme') {
      updateSettings({ themePreset: nextOption(THEME_PRESET_NAMES, themePreset, direction) })
    } else if (selected.type === 'trendColor') {
      updateSettings({ trendColorMode: nextOption(TREND_COLOR_MODES, trendColorMode, direction) })
    } else if (selected.type === 'border') {
      updateSettings({ borderStyle: nextOption(BORDER_STYLES, borderStyle, direction) })
    } else if (selected.type === 'language') {
      updateSettings({ language: nextOption(LANGUAGES, language, direction) })
    } else {
      adjustNumericSetting(selected.setting, direction)
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
        resetSettings()
      }
    },
    { isActive: !overlayOpen.open },
  )

  /** 语言项显示母语名称, 保证切错语言后仍能找回 */
  const valueOf = (item: SettingItem): string => {
    if (item.type === 'theme') return t(THEME_PRESET_KEYS[themePreset])
    if (item.type === 'trendColor') return t(TREND_COLOR_MODE_KEYS[trendColorMode])
    if (item.type === 'border') return t(BORDER_STYLE_KEYS[borderStyle])
    if (item.type === 'language') {
      return language === 'auto'
        ? t('settings.language.auto', { locale: LOCALE_NATIVE_NAMES[locale] })
        : LOCALE_NATIVE_NAMES[language]
    }
    return formatDuration(numericValues[item.setting], t)
  }

  const rowsFor = (group: SettingGroup): SettingRow[] =>
    SETTING_ITEMS.flatMap((item, index) =>
      item.group === group
        ? [
            {
              label: t(item.label),
              description: t(item.description),
              selected: index === selectedIndex,
              value: valueOf(item),
            },
          ]
        : [],
    )

  return {
    overlayOpen,
    appearanceRows: rowsFor('appearance'),
    requestRows: rowsFor('request'),
  }
}
