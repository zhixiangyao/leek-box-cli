import { expect, test } from 'vitest'

import { LOGO_LINES } from '../src/components/AppLogo.tsx'
import { useCommandStore } from '../src/stores/useCommandStore.ts'
import { useDialogMenuStore } from '../src/stores/useDialogMenuStore.ts'
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  assertFrameSize,
  isDimmed,
  renderApp,
  resetStores,
  stubBoardRows,
} from './helpers/app.tsx'
import { CaptureOutput, createInput, plain, unmountApp, waitForFrame } from './helpers/ink.tsx'

test('菜单 overlay 打开时底层命令变暗并保持命令自有的全屏 chrome', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows()
  useCommandStore.setState({ command: 'stock-add' })

  const instance = renderApp(output)

  try {
    const brightFrame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('添加自选股'))
    expect(brightFrame).not.toContain('\u001B[2m')

    const after = output.frames.length
    useDialogMenuStore.getState().open('stock-add')
    const dimmedFrame = await waitForFrame(output, after, (candidate) => {
      const text = plain(candidate)
      return text.includes('添加自选股') && text.includes('自选股票看板') && isDimmed(candidate)
    })
    expect(plain(dimmedFrame)).toMatch(/菜单/)
    expect(plain(dimmedFrame)).toContain(LOGO_LINES[0])
    assertFrameSize(dimmedFrame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的 esc 接线: esc 打开菜单, 再按 esc 关闭', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows()

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('自选股票看板'))

    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => isDimmed(candidate))
    // 打开时的高亮由 App 传入当前命令
    expect(useDialogMenuStore.getState().highlightedType).toBe('stock-list')

    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => !isDimmed(candidate))
    expect(useDialogMenuStore.getState().highlightedType).toBeUndefined()
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
