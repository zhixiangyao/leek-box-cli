import { expect, test } from 'vitest'

import Text from '../src/components/Text.tsx'
import { useTheme } from '../src/hooks/useTheme.ts'
import { THEME_PRESETS } from '../src/settings/schema.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'
import { resetStores } from './helpers/app.tsx'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

function ThemeProbe() {
  const theme = useTheme()
  return <Text>{theme.primary}</Text>
}

test('useTheme 跟随 themePreset 返回对应调色板', async () => {
  resetStores()
  useSettingsStore.setState({ themePreset: 'classic' })
  const output = new CaptureOutput(30, 3)
  const instance = renderInk(<ThemeProbe />, { output })

  try {
    const first = await waitForFrame(output, 0, (candidate) => plain(candidate).includes(THEME_PRESETS.classic.primary))
    expect(plain(first)).toContain(THEME_PRESETS.classic.primary)

    useSettingsStore.setState({ themePreset: 'forest' })
    const after = output.frames.length
    const second = await waitForFrame(output, after, (candidate) =>
      plain(candidate).includes(THEME_PRESETS.forest.primary),
    )
    expect(plain(second)).not.toContain(THEME_PRESETS.classic.primary)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
