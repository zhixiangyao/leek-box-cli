import { setTimeout as delay } from 'node:timers/promises'

import { expect, test, vi } from 'vitest'

import { useDialogConfirmStore } from '../src/stores/useDialogConfirmStore.ts'
import { BOARD_COLUMNS, BOARD_ROWS, renderApp, resetStores, stubBoardRows } from './helpers/app.tsx'
import { CaptureOutput, createInput, plain, waitForFrame } from './helpers/ink.tsx'

test('通用确认弹窗确认态: hint 为 取消(n) 确定(y)', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows()

  const instance = renderApp(output, input)

  try {
    const confirm = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const after = output.frames.length
    useDialogConfirmStore.setState({
      config: { title: '确认重置吗?', content: '此操作将重置所有设置与自选股为默认值.', isError: false, confirm },
    })
    const frame = await waitForFrame(
      output,
      after,
      (candidate) => plain(candidate).includes('确认重置吗') && plain(candidate).includes('取消(n)'),
    )
    expect(plain(frame)).toContain('确定(y)')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('通用确认弹窗错误态: update 换上失败信息并把 hint 切到 关闭(esc) 重试(y)', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows()

  const instance = renderApp(output, input)

  try {
    const confirm = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    useDialogConfirmStore.setState({
      config: { title: '确认重置吗?', content: '此操作将重置所有设置与自选股为默认值.', isError: false, confirm },
    })

    const after = output.frames.length
    useDialogConfirmStore.getState().update({ content: '重置失败: 锁超时', isError: true })
    await waitForFrame(
      output,
      after,
      (candidate) =>
        plain(candidate).includes('重置失败: 锁超时') &&
        plain(candidate).includes('关闭(esc)') &&
        plain(candidate).includes('重试(y)'),
    )
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('通用确认弹窗错误态: 不在 hint 里的 n 被忽略', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows()

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    useDialogConfirmStore.setState({
      config: {
        title: '确认重置吗?',
        content: '重置失败: 锁超时',
        isError: true,
        confirm: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      },
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('重试(y)'))

    input.write('n')
    await delay(100)
    expect(useDialogConfirmStore.getState().config?.isError).toBe(true)
    expect(useDialogConfirmStore.getState().config?.content).toBe('重置失败: 锁超时')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('通用确认弹窗错误态: esc 关闭弹窗', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows()

  const instance = renderApp(output, input)

  try {
    let after = output.frames.length
    useDialogConfirmStore.setState({
      config: {
        title: '确认重置吗?',
        content: '重置失败: 锁超时',
        isError: true,
        confirm: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      },
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('重试(y)'))

    after = output.frames.length
    input.write('\x1B')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('确认重置吗'))
    expect(useDialogConfirmStore.getState().config).toBeUndefined()
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('通用确认弹窗错误态: y 重试成功后关闭弹窗', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows()

  const instance = renderApp(output, input)

  try {
    const confirm = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    let after = output.frames.length
    useDialogConfirmStore.setState({
      config: { title: '确认重置吗?', content: '重置失败: 锁超时', isError: true, confirm },
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('重试(y)'))

    after = output.frames.length
    input.write('y')
    await waitForFrame(output, after, (candidate) => !plain(candidate).includes('确认重置吗'))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(useDialogConfirmStore.getState().config).toBeUndefined()
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})

test('通用确认弹窗错误态: y 重试失败时弹窗保留', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows()

  const instance = renderApp(output, input)

  try {
    const confirm = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('锁超时'))
    const after = output.frames.length
    useDialogConfirmStore.setState({
      config: { title: '确认重置吗?', content: '重置失败: 锁超时', isError: true, confirm },
    })
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('重试(y)'))

    input.write('y')
    await delay(100)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(useDialogConfirmStore.getState().config).not.toBeUndefined()
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})
