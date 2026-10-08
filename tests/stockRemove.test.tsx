import { expect, test } from 'vitest'

import { gridColumnCount } from '../src/components/CheckboxGrid/lib.ts'
import { TABLE_CHROME } from '../src/components/WindowSizeGuard.tsx'
import { t } from '../src/i18n/core.ts'
import { useCommandStore } from '../src/stores/useCommandStore.ts'
import { useDialogRemoveConfirmStore } from '../src/stores/useDialogRemoveConfirmStore.ts'
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
import { CaptureOutput, createInput, plain, unmountApp, waitForFrame, waitForInput } from './helpers/ink.tsx'

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

test('删除成功后网格光标停在原来的位置, 勾选清空', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()
  const dialogStore = useDialogRemoveConfirmStore
  const title = t('dialogRemoveConfirm.titleConfirm', { count: 1 })
  // 光标要走到下标 2, 因此列数至少 3 (与实际推导一致, 见 CheckboxGrid 的 columnCount)
  const columnCount = gridColumnCount(BOARD_COLUMNS - TABLE_CHROME, 2)

  resetStores()
  stubBoardRows([])
  stubRemoveEntries([
    removeEntry('sh600000', '股票A'),
    removeEntry('sz000001', '股票B'),
    removeEntry('sz300001', '股票C'),
    removeEntry('sh601318', '股票D'),
  ])
  useCommandStore.setState({ command: 'stock-remove' })
  // 存储动作 stub 成"删掉 1 条": 收尾动作是命令的 hook 在 open 时登记的
  dialogStore.setState({
    confirmDelete: async () => {
      dialogStore.getState().onRemoved?.(['sh600000'])
      dialogStore.setState({ step: { type: 'idle' }, entries: [], onRemoved: undefined })
    },
  })

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('股票A'))
    expect(columnCount).toBeGreaterThanOrEqual(3)

    // 勾掉第一条, 然后把光标移到下标 2 再提交
    input.write(' ')
    await waitForInput()
    input.write('l')
    await waitForInput()
    input.write('l')
    await waitForInput()
    input.write('\r')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(title))

    input.write('y')
    const frame = await waitForFrame(output, after, (candidate) => !plain(candidate).includes('股票A'))
    // 剩下的重新编号为 股票B, 股票C, 股票D: 光标还在下标 2, 空格勾的是 股票D
    expect(plain(frame)).not.toContain('[x]')

    input.write(' ')
    const checkedFrame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('[x] 股票D'))
    expect(plain(checkedFrame)).not.toContain('[x] 股票B')
    assertFrameSize(checkedFrame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
