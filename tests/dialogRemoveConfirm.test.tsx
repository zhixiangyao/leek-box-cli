import { setTimeout as delay } from 'node:timers/promises'

import { expect, test } from 'vitest'

import { useCommandStore } from '../src/stores/useCommandStore.ts'
import { useDialogRemoveConfirmStore } from '../src/stores/useDialogRemoveConfirmStore.ts'
import { useStockRemoveStore } from '../src/stores/useStockRemoveStore.ts'
import { BOARD_COLUMNS, BOARD_ROWS, renderApp, resetStores, stubBoardRows, stubRemoveEntries } from './helpers/app.tsx'
import { removeEntry } from './helpers/fixtures.ts'
import { CaptureOutput, createInput, plain, unmountApp, waitForFrame, waitForInput } from './helpers/ink.tsx'

test('删除确认弹窗 confirm 阶段忽略不在 hint 里的 esc', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows()

  const instance = renderApp(output, input)

  try {
    const dialogStore = useDialogRemoveConfirmStore
    let after = output.frames.length
    dialogStore.getState().open([removeEntry('sh600000', '浦发银行')])
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))

    input.write('\x1B')
    await delay(100)
    expect(dialogStore.getState().step.type).toBe('confirm')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('删除确认弹窗 confirm 阶段按 n 取消并保留网格勾选', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubRemoveEntries([removeEntry('sh600000', '浦发银行')])

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    useCommandStore.setState({ command: 'stock-remove' })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('浦发银行'))

    const dialogStore = useDialogRemoveConfirmStore
    const token = useStockRemoveStore.getState().resetToken
    after = output.frames.length
    dialogStore.getState().open([removeEntry('sh600000', '浦发银行')])
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))

    after = output.frames.length
    input.write('n')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('确定删除选中的'))
    expect(dialogStore.getState().step).toStrictEqual({ type: 'idle' })
    // 勾选保留: 取消只关弹窗, 网格不重挂载
    expect(useStockRemoveStore.getState().resetToken).toBe(token)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('删除确认弹窗 confirm 阶段按 y 删除成功后同步网格并重挂载', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubRemoveEntries([removeEntry('sh600000', '浦发银行'), removeEntry('sz000001', '平安银行')])

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    useCommandStore.setState({ command: 'stock-remove' })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('浦发银行'))

    const dialogStore = useDialogRemoveConfirmStore
    const token = useStockRemoveStore.getState().resetToken
    // 存储动作 stub 成"删掉 1 条": 弹窗自己收尾, 网格同步走命令的 hook 在 open 时登记的回调
    dialogStore.setState({
      confirmDelete: async () => {
        dialogStore.getState().onRemoved?.(['sh600000'])
        dialogStore.setState({ step: { type: 'idle' }, entries: [], onRemoved: undefined })
      },
    })

    // 光标默认在第一格: 空格勾选后回车提交, 网格把 removeByCodes 登记给弹窗
    after = output.frames.length
    input.write(' ')
    await waitForInput()
    input.write('\r')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))
    expect(dialogStore.getState().onRemoved).toBeDefined()

    after = output.frames.length
    input.write('y')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('确定删除选中的'))
    // 删掉的那条离开网格, 其余保留; resetToken 变化让网格重新挂载, 勾选清空
    expect(useStockRemoveStore.getState().entries.map((entry) => entry.code)).toStrictEqual(['sz000001'])
    expect(useStockRemoveStore.getState().resetToken).toBe(token + 1)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('删除确认弹窗 confirm 阶段按 y 删除失败时保留网格与勾选', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubRemoveEntries([removeEntry('sh600000', '浦发银行')])

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    useCommandStore.setState({ command: 'stock-remove' })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('浦发银行'))

    const dialogStore = useDialogRemoveConfirmStore
    const token = useStockRemoveStore.getState().resetToken
    // 删除失败: 弹窗进入 error, 不调 cb, 网格不该被改写
    dialogStore.setState({
      confirmDelete: async () => {
        dialogStore.setState({ step: { type: 'error', message: '删除失败: 锁超时' } })
        return
      },
    })

    after = output.frames.length
    dialogStore.getState().open([removeEntry('sh600000', '浦发银行')])
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))

    after = output.frames.length
    input.write('y')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('删除失败'))
    // 文件没被改动: 条目与勾选都留着, esc 关闭后可以直接重试
    expect(useStockRemoveStore.getState().entries.map((entry) => entry.code)).toStrictEqual(['sh600000'])
    expect(useStockRemoveStore.getState().resetToken).toBe(token)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('删除确认弹窗 removing 阶段忽略 esc', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows()

  const instance = renderApp(output, input)

  try {
    const dialogStore = useDialogRemoveConfirmStore
    const after = output.frames.length
    dialogStore.setState({ step: { type: 'removing' }, entries: [removeEntry('sh600000', '浦发银行')] })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('正在删除'))

    input.write('\x1B')
    await delay(100)
    expect(dialogStore.getState().step.type).toBe('removing')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('删除确认弹窗 done 阶段 esc 关闭', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows()

  const instance = renderApp(output, input)

  try {
    const dialogStore = useDialogRemoveConfirmStore
    let after = output.frames.length
    dialogStore.setState({
      step: { type: 'done', message: '已删除 1 个股票, 1 个条目已不在自选股中.' },
      entries: [],
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('删除完成'))

    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('删除完成'))
    expect(dialogStore.getState().step).toStrictEqual({ type: 'idle' })
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('删除确认弹窗 error 阶段 esc 关闭', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows()

  const instance = renderApp(output, input)

  try {
    const dialogStore = useDialogRemoveConfirmStore
    let after = output.frames.length
    dialogStore.setState({
      step: { type: 'error', message: '删除失败: 锁超时' },
      entries: [removeEntry('sh600000', '浦发银行')],
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('删除失败'))

    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('删除失败'))
    expect(dialogStore.getState().step).toStrictEqual({ type: 'idle' })
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('删除确认弹窗在条目没有名称时只列代码, 不留空括号', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows()

  const instance = renderApp(output)

  try {
    const after = output.frames.length
    useDialogRemoveConfirmStore.getState().open([removeEntry('sh600000')])
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))
    expect(plain(frame)).toContain('sh600000')
    expect(plain(frame)).not.toContain('(sh600000)')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('删除确认弹窗在条目有名称时列 名称 (代码)', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows()

  const instance = renderApp(output)

  try {
    const after = output.frames.length
    useDialogRemoveConfirmStore.getState().open([removeEntry('sh600000', '浦发银行')])
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes('确定删除选中的'))
    expect(plain(frame)).toContain('浦发银行 (sh600000)')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
