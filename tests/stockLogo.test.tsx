import { expect, test } from 'vitest'

import StockLogo from '../src/components/StockLogo.tsx'
import { t } from '../src/i18n/core.ts'
import { resetStores } from './helpers/app.tsx'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

const renderLogo = async (code: string | undefined) => {
  resetStores()
  const output = new CaptureOutput(20, 3)
  const instance = renderInk(<StockLogo code={code} />, { output })
  try {
    return await waitForFrame(output, 0, (candidate) => plain(candidate).trim().length > 0)
  } finally {
    await unmountApp(instance)
  }
}

test('StockLogo 按市场前缀显示沪, 深, 北', async () => {
  expect(plain(await renderLogo('sh600000'))).toContain(t('stockLogo.sh'))
  expect(plain(await renderLogo('sz000001'))).toContain(t('stockLogo.sz'))
  expect(plain(await renderLogo('bj430047'))).toContain(t('stockLogo.bj'))
})

test('StockLogo 对缺失或未知前缀显示方块占位', async () => {
  expect(plain(await renderLogo('us123456'))).toContain('■')
  expect(plain(await renderLogo(undefined))).toContain('■')
})
