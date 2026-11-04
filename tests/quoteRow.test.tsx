import { expect, test } from 'vitest'

import QuoteRow from '../src/components/QuoteRow.tsx'
import { quoteRow, stockListColumns } from '../src/lib/quoteTable.ts'
import { resetStores } from './helpers/app.tsx'
import { quote } from './helpers/fixtures.ts'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

test('QuoteRow 渲染分段文本, 选中时整行反显', async () => {
  resetStores()
  const segments = quoteRow(stockListColumns(), quote(), 'red-up')

  const normalOutput = new CaptureOutput(120, 3)
  const normalInstance = renderInk(<QuoteRow segments={segments} />, { output: normalOutput })
  try {
    const frame = await waitForFrame(normalOutput, 0, (candidate) => plain(candidate).includes('浦发银行'))
    expect(plain(frame)).toContain('sh600000')
    // 上涨用红色
    expect(frame).toContain('\u001B[31m')
    expect(frame).not.toContain('\u001B[7m')
  } finally {
    await unmountApp(normalInstance)
  }

  const selectedOutput = new CaptureOutput(120, 3)
  const selectedInstance = renderInk(<QuoteRow segments={segments} selected />, {
    output: selectedOutput,
  })
  try {
    const frame = await waitForFrame(selectedOutput, 0, (candidate) => plain(candidate).includes('浦发银行'))
    expect(frame).toContain('\u001B[7m')
  } finally {
    await unmountApp(selectedInstance)
    resetStores()
  }
})
