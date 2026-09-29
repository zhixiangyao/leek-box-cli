import { createElement } from 'react'
import { expect } from 'vitest'

import App from '../../src/app.tsx'
import { MIN_TERMINAL_ROWS } from '../../src/components/WindowSizeGuard.tsx'
import { setActiveLocale, t } from '../../src/i18n/core.ts'
import { DEFAULT_LOCALE } from '../../src/i18n/locale.ts'
import { stockListColumns, tableWidth } from '../../src/lib/quoteTable.ts'
import { useCommandStore } from '../../src/stores/useCommandStore.ts'
import { useDialogConfirmStore } from '../../src/stores/useDialogConfirmStore.ts'
import { useDialogMenuStore } from '../../src/stores/useDialogMenuStore.ts'
import { useDialogRemoveConfirmStore } from '../../src/stores/useDialogRemoveConfirmStore.ts'
import { useDialogStockDetailStore } from '../../src/stores/useDialogStockDetailStore.ts'
import { useSettingsStore } from '../../src/stores/useSettingsStore.ts'
import { useStockAddStore } from '../../src/stores/useStockAddStore.ts'
import type { StockListRow } from '../../src/stores/useStockListStore.ts'
import { useStockListStore } from '../../src/stores/useStockListStore.ts'
import type { StockRemoveEntry } from '../../src/stores/useStockRemoveStore.ts'
import { useStockRemoveStore } from '../../src/stores/useStockRemoveStore.ts'
import { CaptureOutput, createInput, plain, renderInk, type TestInput } from './ink.tsx'

export const STOCK_LIST_COLUMNS = stockListColumns()

/** 终端尺寸: 宽度在表格占宽之外留点余量, 高度在守卫下限之上留出边框 */
export const BOARD_COLUMNS = tableWidth(STOCK_LIST_COLUMNS) + 10
export const BOARD_ROWS = MIN_TERMINAL_ROWS + 6

/**
 * 语言固定为简体中文: 默认值 auto 会跟随运行环境的系统语言,
 * 断言渲染帧的测试必须与机器语言无关.
 */
export const resetStores = () => {
  useStockAddStore.setState(useStockAddStore.getInitialState(), true)
  useStockRemoveStore.setState(useStockRemoveStore.getInitialState(), true)
  useDialogMenuStore.setState(useDialogMenuStore.getInitialState(), true)
  useDialogConfirmStore.setState(useDialogConfirmStore.getInitialState(), true)
  useDialogRemoveConfirmStore.setState(useDialogRemoveConfirmStore.getInitialState(), true)
  useCommandStore.setState(useCommandStore.getInitialState(), true)
  useSettingsStore.setState({ ...useSettingsStore.getInitialState(), language: DEFAULT_LOCALE }, true)
  useDialogStockDetailStore.setState(useDialogStockDetailStore.getInitialState(), true)
  useStockListStore.setState(useStockListStore.getInitialState(), true)
  setActiveLocale(DEFAULT_LOCALE)
}

/** 把 App 渲染到固定尺寸的输出: 需要注入按键的用例自己传 input */
export const renderApp = (output: CaptureOutput, input: TestInput = createInput()) =>
  renderInk(createElement(App), { output, input })

/** 把看板钉在给定行上: 轮询保持这些行不变, 用例只关心自己那部分行为 */
export const stubBoardRows = (rows: StockListRow[] = []) => {
  useStockListStore.setState({
    refreshQuotes: async () => {
      useStockListStore.setState({ step: { type: 'table', rows } })
    },
    step: { type: 'table', rows },
  })
}

/** 把删除网格钉在给定条目上: loadEntries 直接铺出条目, 不读文件也不拉行情 */
export const stubRemoveEntries = (entries: StockRemoveEntry[]) => {
  useStockRemoveStore.setState({
    loadEntries: async () => {
      useStockRemoveStore.setState({ entries })
    },
  })
}

export const assertFrameSize = (frame: string, columns: number, rows: number) => {
  const lines = plain(frame).split('\n')
  expect(lines).toHaveLength(rows)
  expect(lines.at(-1)?.length).toBe(columns)
}

/** SGR 参数里含 7 即反显: 只看参数本身, 避免把 27 (关闭反显) 也算进来 */
const isInverseLine = (line: string) =>
  line
    .split('\x1B[')
    .slice(1)
    .some((sequence) => sequence.slice(0, sequence.indexOf('m')).split(';').includes('7'))

/** 选中行整行反显, 从帧里取那一行的代码 (选中行是 hook 的状态, store 里没有) */
export const selectedCodeIn = (frame: string): string | undefined =>
  frame
    .split('\n')
    .filter(isInverseLine)
    .map((line) => line.match(/sh\d{6}|sz\d{6}/)?.[0])
    .find((code) => code !== undefined)

/** 变暗: 浮层打开时底层命令与旧浮层都带 dim, 据此判定谁不亮 */
export const isDimmed = (frame: string) => frame.includes('\u001B[2m')

/** 剩余条数随可视高度和窗口位置变化, 不是定值, 因此按文案模板取 */
export const remainingPattern = () => new RegExp(t('stockList.remaining', { count: 0 }).replace('0', '\\d+'))
export const remainingTextIn = (frame: string) => plain(frame).match(remainingPattern())?.[0]
