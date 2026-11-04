import { Box } from 'ink'
import type { ReactElement } from 'react'
import { expect, test } from 'vitest'

import Text from '../src/components/Text.tsx'
import { useDialogMenuStore } from '../src/stores/useDialogMenuStore.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'
import { isDimmedAt, resetStores } from './helpers/app.tsx'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

const renderText = async (element: ReactElement) => {
  const output = new CaptureOutput(40, 5)
  const instance = renderInk(element, { output })
  try {
    return await waitForFrame(output, 0, (candidate) => plain(candidate).trim().length > 0)
  } finally {
    await unmountApp(instance)
  }
}

test('Text 未显式传 color 时使用主题 foreground, 显式 color 优先', async () => {
  resetStores()
  useSettingsStore.setState({ themePreset: 'classic' })

  // classic foreground 是 white (SGR 37)
  expect(await renderText(<Text>theme-foreground</Text>)).toContain('\u001B[37m')
  const explicit = await renderText(<Text color="red">explicit-color</Text>)
  expect(explicit).toContain('\u001B[31m')
  expect(explicit).not.toContain('\u001B[37m')
})

test('Text 在浮层打开时变暗, bright 文本保持明亮', async () => {
  resetStores()
  useDialogMenuStore.setState({ highlightedType: 'stock-list' })

  const frame = await renderText(
    <Box flexDirection="column">
      <Text>dim-text</Text>
      <Text bright>bright-text</Text>
    </Box>,
  )
  expect(isDimmedAt(frame, 'dim-text')).toBe(true)
  expect(isDimmedAt(frame, 'bright-text')).toBe(false)
  resetStores()
})
