import { expect, test } from 'vitest'

import { t } from '../src/i18n/core.ts'
import { useCommandStore } from '../src/stores/useCommandStore.ts'
import {
  assertFrameSize,
  BOARD_COLUMNS,
  BOARD_ROWS,
  renderApp,
  resetStores,
  stubBoardRows,
  stubRemoveEntries,
} from './helpers/app.tsx'
import { removeEntry } from './helpers/fixtures.ts'
import { CaptureOutput, plain, unmountApp, waitForFrame } from './helpers/ink.tsx'

test('App 的删除命令渲染自己的标题与 hint', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows([])
  stubRemoveEntries([removeEntry('sh600000', '删除测试股')])
  useCommandStore.setState({ command: 'stock-remove' })

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('删除自选股'))
    expect(plain(frame)).toContain(t('command.stockRemove.hint'))
    expect(plain(frame)).not.toMatch(/15:00 \(5000ms\)/)
    expect(plain(frame)).toMatch(/删除测试股/)
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('删除网格在条目没有名称时单元格只显示代码', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows([])
  stubRemoveEntries([removeEntry('sh600000')])
  useCommandStore.setState({ command: 'stock-remove' })

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(
      output,
      0,
      (candidate) => plain(candidate).includes('删除自选股') && plain(candidate).includes('sh600000'),
    )
    expect(plain(frame)).toContain('[ ] sh600000')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
