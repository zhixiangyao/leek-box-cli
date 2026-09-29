import { expect, test } from 'vitest'

import { t } from '../src/i18n/core.ts'
import { useCommandStore } from '../src/stores/useCommandStore.ts'
import { assertFrameSize, BOARD_COLUMNS, BOARD_ROWS, renderApp, resetStores, stubBoardRows } from './helpers/app.tsx'
import { CaptureOutput, plain, unmountApp, waitForFrame } from './helpers/ink.tsx'

test('App 的添加命令渲染自己的标题与 hint', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'stock-add' })

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('添加自选股'))
    expect(plain(frame)).toContain(t('command.stockAdd.hint'))
    expect(plain(frame)).not.toMatch(/15:00 \(5000ms\)/)
    expect(plain(frame)).toMatch(/请输入股票代码/)
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
