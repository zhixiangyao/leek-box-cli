import { expect, test } from 'vitest'

import { LOGO_LINES } from '../src/components/AppLogo.tsx'
import { MIN_TERMINAL_COLUMNS, MIN_TERMINAL_ROWS } from '../src/components/WindowSizeGuard.tsx'
import { useCommandStore } from '../src/stores/useCommandStore.ts'
import { useDialogMenuStore } from '../src/stores/useDialogMenuStore.ts'
import { useDialogStockDetailStore } from '../src/stores/useDialogStockDetailStore.ts'
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  assertFrameSize,
  isDimmed,
  renderApp,
  resetStores,
  stubBoardRows,
} from './helpers/app.tsx'
import { quoteRow } from './helpers/fixtures.ts'
import { CaptureOutput, createInput, plain, unmountApp, waitForFrame, waitForInput } from './helpers/ink.tsx'

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

/**
 * 浮层打开时 App 的 useInput 是唯一可能失活的输入入口 (浮层持有另一个), 而尺寸不足时
 * WindowSizeGuard 会卸载整棵子树. 若此时一个活跃的 useInput 都不剩, ink 会 setRawMode(false)
 * 并 unref stdin, 事件循环空转触发 beforeExit, 应用在用户拖动终端尺寸时就退出了.
 * 这里用 unref 是否被调用来锁定 "进程仍被 stdin 引用" 这条不变量.
 */
test('浮层打开时终端尺寸不足, stdin 仍被引用', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()
  let unrefCount = 0
  input.unref = () => {
    unrefCount += 1
    return input
  }

  resetStores()
  stubBoardRows([quoteRow('sh600000', 1)])
  useDialogStockDetailStore.setState({ code: 'sh600000', refreshChart: async () => {} })

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('sh600000'))

    after = output.frames.length
    output.resize(MIN_TERMINAL_COLUMNS - 1, MIN_TERMINAL_ROWS - 1)
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('终端尺寸过小'))
    // ink 关掉 raw mode 是在微任务里做的, 让出一拍再断言
    await waitForInput()

    expect(unrefCount).toBe(0)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
