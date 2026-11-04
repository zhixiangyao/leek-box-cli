import { expect, test } from 'vitest'

import Text from '../src/components/Text.tsx'
import { useTranslation } from '../src/hooks/useTranslation.ts'
import { createTranslator } from '../src/i18n/core.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'
import { resetStores } from './helpers/app.tsx'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

function TranslationProbe() {
  const { locale, t } = useTranslation()
  return <Text>{`${locale}|${t('command.stockList.title')}`}</Text>
}

test('useTranslation 随 language 切换 locale 与文案', async () => {
  resetStores()
  const output = new CaptureOutput(60, 3)
  const instance = renderInk(<TranslationProbe />, { output })

  try {
    const first = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('zh-hans|'))
    expect(plain(first)).toContain(createTranslator('zh-hans')('command.stockList.title'))

    useSettingsStore.getState().updateSettings({ language: 'en' })
    const after = output.frames.length
    const second = await waitForFrame(output, after, (candidate) => plain(candidate).includes('en|'))
    expect(plain(second)).toContain(createTranslator('en')('command.stockList.title'))
    expect(plain(second)).not.toContain(createTranslator('zh-hans')('command.stockList.title'))
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
