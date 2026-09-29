import { expect, test } from 'vitest'

import { t } from '../src/i18n/core.ts'
import { useCommandStore } from '../src/stores/useCommandStore.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'
import { assertFrameSize, BOARD_COLUMNS, BOARD_ROWS, renderApp, resetStores, stubBoardRows } from './helpers/app.tsx'
import { CaptureOutput, createInput, plain, waitForFrame, waitForState } from './helpers/ink.tsx'

test('App 的设置命令渲染自己的标题与 hint', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'settings' })

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('› 主题色系'))
    expect(plain(frame)).toContain(t('command.settings.title'))
    expect(plain(frame)).toContain(t('command.settings.hint'))
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的 vim 键: 设置命令 j/k 移动选中的配置项', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'settings' })

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('› 主题色系'))

    after = output.frames.length
    input.write('j')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('› 涨跌颜色'))
    after = output.frames.length
    input.write('k')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('› 主题色系'))
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('App 的 vim 键: 设置命令 h/l 切换 option 类配置项', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'settings' })

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    input.write('j')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('› 涨跌颜色'))

    const initialMode = useSettingsStore.getState().trendColorMode
    input.write('l')
    await waitForState(() => useSettingsStore.getState().trendColorMode !== initialMode)
    input.write('h')
    await waitForState(() => useSettingsStore.getState().trendColorMode === initialMode)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})
