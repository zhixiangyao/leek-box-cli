import { expect, test } from 'vitest'

import { t } from '../src/i18n/core.ts'
import { useCommandStore } from '../src/stores/useCommandStore.ts'
import { useDialogMenuStore } from '../src/stores/useDialogMenuStore.ts'
import { useInputFocusStore } from '../src/stores/useInputFocusStore.ts'
import { assertFrameSize, BOARD_COLUMNS, BOARD_ROWS, renderApp, resetStores, stubBoardRows } from './helpers/app.tsx'
import { CaptureOutput, createInput, plain, unmountApp, waitForFrame, waitForState } from './helpers/ink.tsx'

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

test('股票代码输入框聚焦时 q 归输入框所有, 不退出应用', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'stock-add' })

  const instance = renderApp(output, input)

  try {
    await waitForState(() => useInputFocusStore.getState().activeCount === 1)

    const after = output.frames.length
    input.write('q')
    const frame = await waitForFrame(output, after, (candidate) =>
      plain(candidate).includes(`${t('stockAdd.codePrompt')}q`),
    )
    expect(plain(frame)).toContain(`${t('stockAdd.codePrompt')}q`)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('文本输入聚焦时 esc 仍打开菜单', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'stock-add' })

  const instance = renderApp(output, input)

  try {
    await waitForState(() => useInputFocusStore.getState().activeCount === 1)

    input.write('\x1B')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === 'stock-add')
    // 浮层打开后输入框失活, 关闭菜单后重新获得焦点
    await waitForState(() => useInputFocusStore.getState().activeCount === 0)

    input.write('\x1B')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === undefined)
    await waitForState(() => useInputFocusStore.getState().activeCount === 1)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
