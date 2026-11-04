import { expect, test } from 'vitest'

import { t } from '../src/i18n/core.ts'
import { DEFAULT_SETTINGS } from '../src/settings/schema.ts'
import { useCommandStore } from '../src/stores/useCommandStore.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'
import { assertFrameSize, BOARD_COLUMNS, BOARD_ROWS, renderApp, resetStores, stubBoardRows } from './helpers/app.tsx'
import {
  CaptureOutput,
  createInput,
  plain,
  unmountApp,
  waitForFrame,
  waitForInput,
  waitForState,
} from './helpers/ink.tsx'

const selected = (key: Parameters<typeof t>[0]) => `› ${t(key)}`
const SELECTED_THEME = selected('settings.row.theme.label')
const SELECTED_TREND_COLOR = selected('settings.row.trendColor.label')
const SELECTED_BORDER = selected('settings.row.border.label')
const SELECTED_LANGUAGE = selected('settings.row.language.label')
const SELECTED_REQUEST_TIMEOUT = selected('settings.row.requestTimeout.label')

test('App 的设置命令渲染自己的标题与 hint', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'settings' })

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes(SELECTED_THEME))
    expect(plain(frame)).toContain(t('command.settings.title'))
    expect(plain(frame)).toContain(t('command.settings.hint'))
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
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
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(SELECTED_THEME))

    after = output.frames.length
    input.write('j')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(SELECTED_TREND_COLOR))
    after = output.frames.length
    input.write('k')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(SELECTED_THEME))
  } finally {
    await unmountApp(instance)
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
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(SELECTED_TREND_COLOR))

    const initialMode = useSettingsStore.getState().trendColorMode
    input.write('l')
    await waitForState(() => useSettingsStore.getState().trendColorMode !== initialMode)
    input.write('h')
    await waitForState(() => useSettingsStore.getState().trendColorMode === initialMode)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的设置命令 Enter 与右方向键同样切换 option', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'settings' })

  const instance = renderApp(output, input)

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes(SELECTED_THEME))

    input.write('\r')
    await waitForState(() => useSettingsStore.getState().themePreset === 'ocean')
    input.write('\r')
    await waitForState(() => useSettingsStore.getState().themePreset === 'forest')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的设置命令 d 恢复默认值', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'settings' })

  const instance = renderApp(output, input)

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes(SELECTED_THEME))

    input.write('\r')
    await waitForState(() => useSettingsStore.getState().themePreset === 'ocean')

    input.write('d')
    await waitForState(() => useSettingsStore.getState().themePreset === 'classic')
    expect(useSettingsStore.getState().requestTimeoutMs).toBe(DEFAULT_SETTINGS.requestTimeoutMs)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的设置命令方向键调整数值项并钳制在边界内', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'settings' })

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    // 外观组 4 项之后是请求组的 requestTimeoutMs
    for (const label of [SELECTED_TREND_COLOR, SELECTED_BORDER, SELECTED_LANGUAGE, SELECTED_REQUEST_TIMEOUT]) {
      input.write('j')
      await waitForFrame(output, after, (candidate) => plain(candidate).includes(label))
      after = output.frames.length
    }

    input.write('l')
    await waitForState(() => useSettingsStore.getState().requestTimeoutMs === 9000)
    input.write('h')
    await waitForState(() => useSettingsStore.getState().requestTimeoutMs === 8000)

    // 钳制到上限后继续加不再变化
    useSettingsStore.setState({ requestTimeoutMs: 60_000 })
    await waitForFrame(output, after, (candidate) =>
      plain(candidate).includes(t('settings.duration.minutes', { value: 1 })),
    )
    input.write('l')
    await waitForInput()
    expect(useSettingsStore.getState().requestTimeoutMs).toBe(60_000)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('App 的设置命令按档位格式化时长', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows([])
  // 直接写入各档位取值: 显示格式只由 formatDuration 决定, 不经过 clamp
  useSettingsStore.setState({
    requestTimeoutMs: 0,
    minimumRequestDurationMs: 500,
    quotePollIntervalMs: 1500,
    minuteChartPollIntervalMs: 60_000,
    klinePollIntervalMs: 120_000,
  })
  useCommandStore.setState({ command: 'settings' })

  const instance = renderApp(output)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes(SELECTED_THEME))
    const text = plain(frame)
    expect(text).toContain(t('settings.duration.off'))
    expect(text).toContain(t('settings.duration.rawMs', { value: 500 }))
    expect(text).toContain(t('settings.duration.seconds', { value: '1.50' }))
    expect(text).toContain(t('settings.duration.minutes', { value: 1 }))
    expect(text).toContain(t('settings.duration.minutes', { value: 2 }))
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
