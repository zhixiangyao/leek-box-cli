import { THEME_PRESETS, type ThemePalette } from '../stores/useSettingsStore.ts'
import { useSettingsStore } from '../stores/useSettingsStore.ts'

export function useTheme(): ThemePalette {
  return useSettingsStore((state) => THEME_PRESETS[state.themePreset])
}
