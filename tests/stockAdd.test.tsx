import { expect, test } from 'vitest'

import { t } from '../src/i18n/core.ts'
import { formatPrice } from '../src/lib/format.ts'
import { useCommandStore } from '../src/stores/useCommandStore.ts'
import { useDialogMenuStore } from '../src/stores/useDialogMenuStore.ts'
import { useInputFocusStore } from '../src/stores/useInputFocusStore.ts'
import { useStockAddStore } from '../src/stores/useStockAddStore.ts'
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

test('股票代码输入非法时在输入框上方显示错误', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'stock-add' })

  const instance = renderApp(output)

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes(t('stockAdd.codePrompt')))

    const after = output.frames.length
    useStockAddStore.setState({
      codeInput: { error: t('stockAdd.invalidCode'), resetToken: 1 },
    })

    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(t('stockAdd.invalidCode')))
    expect(plain(frame)).toContain(t('stockAdd.invalidCode'))
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('校验阶段显示正在验证的股票代码', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'stock-add' })

  const instance = renderApp(output)

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes(t('stockAdd.codePrompt')))

    const after = output.frames.length
    useStockAddStore.setState({ step: { type: 'checking', codes: ['sh600000', 'sz000001'] } })

    const msg = t('stockAdd.checking', { codes: 'sh600000, sz000001' })
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(msg))
    expect(plain(frame)).toContain(msg)
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('确认阶段列出候选股票并显示 y/n 输入错误', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'stock-add' })

  const instance = renderApp(output)

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes(t('stockAdd.codePrompt')))

    const after = output.frames.length
    useStockAddStore.setState({
      step: {
        type: 'confirm',
        entries: [
          { code: 'sh600000', name: '浦发银行', current: 10 },
          { code: 'sz000001', name: '平安银行', current: 11.5 },
        ],
      },
      confirmInput: { error: t('common.yesNoError'), resetToken: 1 },
    })

    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(t('common.yesNoError')))
    const text = plain(frame)
    expect(text).toContain(t('stockAdd.found'))
    expect(text).toContain(t('stockAdd.candidate', { name: '浦发银行', code: 'sh600000', price: formatPrice(10) }))
    expect(text).toContain(t('stockAdd.candidate', { name: '平安银行', code: 'sz000001', price: formatPrice(11.5) }))
    expect(text).toContain(t('stockAdd.confirmPrompt'))
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('保存阶段显示正在添加的股票数量', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'stock-add' })

  const instance = renderApp(output)

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes(t('stockAdd.codePrompt')))

    const after = output.frames.length
    useStockAddStore.setState({
      step: {
        type: 'saving',
        entries: [{ code: 'sh600000', name: '浦发银行', current: 10 }],
      },
    })

    const msg = t('stockAdd.saving', { count: 1 })
    const frame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(msg))
    expect(plain(frame)).toContain(msg)
    assertFrameSize(frame, BOARD_COLUMNS, BOARD_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('结果阶段按类型显示提示, 回车返回代码输入', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([])
  useCommandStore.setState({ command: 'stock-add' })

  const instance = renderApp(output, input)

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes(t('stockAdd.codePrompt')))

    const after = output.frames.length
    const entries = [{ code: 'sh600000', name: '浦发银行', current: 10 }]
    const alreadyExists = t('stockAdd.alreadyExists', { entries: '浦发银行 (sh600000)' })
    useStockAddStore.setState({ step: { type: 'already-exists', entries } })

    const existsFrame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(alreadyExists))
    expect(plain(existsFrame)).toContain(alreadyExists)
    expect(plain(existsFrame)).toContain(t('common.returnPrompt'))

    input.write('\r')
    await waitForState(() => useStockAddStore.getState().step.type === 'input-code')
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(t('stockAdd.codePrompt')))

    const doneMessage = t('stockAdd.done', { count: 1, existing: 0 })
    useStockAddStore.setState({ step: { type: 'done', message: doneMessage } })
    const doneFrame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(doneMessage))
    expect(plain(doneFrame)).toContain(doneMessage)

    const errorMessage = t('stockAdd.writeFailed', { error: 'disk full' })
    useStockAddStore.setState({ step: { type: 'error', message: errorMessage } })
    const errorFrame = await waitForFrame(output, after, (candidate) => plain(candidate).includes(errorMessage))
    expect(plain(errorFrame)).toContain(errorMessage)
    assertFrameSize(errorFrame, BOARD_COLUMNS, BOARD_ROWS)
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
