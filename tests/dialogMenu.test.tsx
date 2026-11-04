import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

import { expect, test } from 'vitest'

import { t } from '../src/i18n/core.ts'
import { MENU_ITEMS } from '../src/navigation/menu.ts'
import { settingsPath } from '../src/settings/file.ts'
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS } from '../src/settings/schema.ts'
import { useCommandStore } from '../src/stores/useCommandStore.ts'
import { useDialogConfirmStore } from '../src/stores/useDialogConfirmStore.ts'
import { useDialogMenuStore } from '../src/stores/useDialogMenuStore.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  isDimmed,
  renderApp,
  resetStores,
  selectedCodeIn,
  stubBoardRows,
} from './helpers/app.tsx'
import { missingRow } from './helpers/fixtures.ts'
import {
  CaptureOutput,
  createInput,
  plain,
  unmountApp,
  waitForFrame,
  waitForInput,
  waitForState,
} from './helpers/ink.tsx'

test('App 的 vim 键: 菜单打开时 j/k 只移动菜单高亮, 看板选中行不动', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([missingRow('sh600000'), missingRow('sz000001')])

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    input.write('\x1B')
    // 菜单打开后底层命令变暗: 不能匹配 '菜单', 状态栏的看板 hint 里也有这两个字
    const menuFrame = await waitForFrame(output, after, (candidate) => isDimmed(candidate))
    expect(plain(menuFrame)).toContain('选择(↑/↓/j/k)')

    input.write('j')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS[1]!.type)
    input.write('k')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS[0]!.type)
    // 菜单开着时看板仍是反显那一行, 选中行没被 j/k 带走
    const afterMenuKeys = await waitForFrame(output, after, (candidate) => isDimmed(candidate))
    expect(selectedCodeIn(afterMenuKeys)).toBe('sh600000')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('菜单打开时高亮当前命令, esc 关闭且不动命令', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])

  const instance = renderApp(output, input)

  try {
    input.write('\x1B')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === 'stock-list')

    input.write('\x1B')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === undefined)
    expect(useCommandStore.getState().command).toBe('stock-list')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('菜单的方向键在首尾循环, Enter 切换命令并关闭菜单', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    input.write('\x1B')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS[0]!.type)

    // 首项向上循环到末项
    input.write('k')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS.at(-1)!.type)
    // 末项向下循环回首项
    input.write('j')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS[0]!.type)

    // 依次下移到 settings 再按 Enter
    input.write('j')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS[1]!.type)
    input.write('j')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS[2]!.type)
    input.write('j')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS[3]!.type)
    input.write('\r')

    await waitForState(() => useCommandStore.getState().command === 'settings')
    expect(useDialogMenuStore.getState().highlightedType).toBeUndefined()
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(t('command.settings.title')))
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('菜单的数字快捷键选择对应项, 越界数字被忽略', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    input.write('\x1B')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === 'stock-list')

    // 越界数字不关闭菜单也不切换命令
    input.write('9')
    await waitForInput()
    expect(useDialogMenuStore.getState().highlightedType).toBe('stock-list')
    expect(useCommandStore.getState().command).toBe('stock-list')

    // 3 对应 stock-remove
    input.write('3')
    await waitForState(() => useCommandStore.getState().command === 'stock-remove')
    expect(useDialogMenuStore.getState().highlightedType).toBeUndefined()
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(t('command.stockRemove.title')))
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('菜单的重置项打开确认弹窗, 确认后重置设置与文件且菜单保持打开', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()
  const configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-menu-'))
  const previousConfigHome = process.env['XDG_CONFIG_HOME']
  let instance: ReturnType<typeof renderApp> | undefined

  try {
    process.env['XDG_CONFIG_HOME'] = configHome
    resetStores()
    stubBoardRows([])
    useSettingsStore.getState().updateSettings({ themePreset: 'ocean' })
    instance = renderApp(output, input)

    const after = output.frames.length
    input.write('\x1B')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === 'stock-list')

    // 5 对应 reset: 打开确认弹窗, 高亮停在重置项
    input.write('5')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === 'reset')
    await waitForState(() => useDialogConfirmStore.getState().config !== undefined)
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(t('menu.resetConfirmTitle')))

    input.write('y')
    await waitForState(() => useDialogConfirmStore.getState().config === undefined)
    await waitForState(() => useSettingsStore.getState().themePreset === DEFAULT_SETTINGS.themePreset)

    // 写盘内容是完整的默认文档, 不只是文件存在
    const document = JSON.parse(await readFile(settingsPath(), 'utf8')) as {
      schemaVersion: number
      theme: Record<string, unknown>
      request: Record<string, unknown>
      stocks: { code: string }[]
    }
    expect(document.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(document.theme).toStrictEqual({
      preset: DEFAULT_SETTINGS.themePreset,
      trendColorMode: DEFAULT_SETTINGS.trendColorMode,
      borderStyle: DEFAULT_SETTINGS.borderStyle,
    })
    expect(document.request).toStrictEqual({
      timeoutMs: DEFAULT_SETTINGS.requestTimeoutMs,
      minimumDurationMs: DEFAULT_SETTINGS.minimumRequestDurationMs,
      quotePollIntervalMs: DEFAULT_SETTINGS.quotePollIntervalMs,
      minuteChartPollIntervalMs: DEFAULT_SETTINGS.minuteChartPollIntervalMs,
      klinePollIntervalMs: DEFAULT_SETTINGS.klinePollIntervalMs,
    })
    expect(document.stocks.map((stock) => stock.code)).toStrictEqual(['sz002156', 'sh600584', 'sh688825'])

    // 确认弹窗关闭后菜单仍在, 高亮保持
    expect(useDialogMenuStore.getState().highlightedType).toBe('reset')
    await waitForFrame(output, after, (candidate) => isDimmed(candidate))
  } finally {
    if (instance) await unmountApp(instance)
    resetStores()
    if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previousConfigHome
    await rm(configHome, { recursive: true, force: true })
  }
})

test('菜单的退出项结束 Ink 渲染', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])

  const instance = renderApp(output, input)

  try {
    input.write('\x1B')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === 'stock-list')

    // 6 对应 exit
    input.write('6')
    await instance.waitUntilExit()
  } finally {
    resetStores()
  }
})
