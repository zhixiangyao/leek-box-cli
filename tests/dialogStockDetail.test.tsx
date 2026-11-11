import { Box } from 'ink'
import { expect, test } from 'vitest'

import DialogStockDetail from '../src/components/DialogStockDetail/index.tsx'
import { t } from '../src/i18n/core.ts'
import { EMPTY_VALUE } from '../src/lib/format.ts'
import { useDialogStockDetailStore } from '../src/stores/useDialogStockDetailStore.ts'
import { useStockListStore } from '../src/stores/useStockListStore.ts'
import { BOARD_COLUMNS, BOARD_ROWS, resetStores } from './helpers/app.tsx'
import { quote } from './helpers/fixtures.ts'
import {
  CaptureOutput,
  createInput,
  plain,
  renderInk,
  unmountApp,
  waitForFrame,
  waitForInput,
  waitForState,
} from './helpers/ink.tsx'

/** 详情弹窗自己读 store, 测试直接钉住状态, 图表请求不联网 */
const openDetail = (overrides: Partial<ReturnType<typeof useDialogStockDetailStore.getState>> = {}) => {
  useDialogStockDetailStore.setState({
    code: 'sh600000',
    period: 'intraday',
    status: 'loading',
    points: [],
    errorMessage: undefined,
    refreshChart: async () => undefined,
    ...overrides,
  })
  useStockListStore.setState({
    step: { type: 'table', rows: [{ kind: 'quote', code: 'sh600000', quote: quote() }] },
  })
}

const renderDetail = (input = createInput()) => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  // 弹窗用 absolute 铺满终端, 需要给定尺寸的父盒作为布局基准
  const instance = renderInk(
    <Box width={BOARD_COLUMNS} height={BOARD_ROWS} flexDirection="column">
      <DialogStockDetail />
    </Box>,
    { output, input },
  )
  return { output, input, instance }
}

test('详情弹窗渲染标题, 周期快捷键与加载文案', async () => {
  resetStores()
  openDetail()
  const { output, instance } = renderDetail()

  try {
    const frame = await waitForFrame(output, 0, (candidate) =>
      plain(candidate).includes(t('dialogStockDetail.loading', { period: t('chart.period.intraday') })),
    )
    const text = plain(frame)
    expect(text).toContain('浦发银行')
    expect(text).toContain('sh600000')
    expect(text).toContain(t('dialogStockDetail.hint'))
    // 六个周期快捷键都列在标题右侧
    for (const key of ['1', '2', '3', '4', '5', '6']) {
      expect(text).toContain(`[${key}]`)
    }
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('详情弹窗渲染请求错误与空数据文案', async () => {
  resetStores()
  openDetail({ status: 'error', errorMessage: '接口超时' })
  const errorRender = renderDetail()

  try {
    const frame = await waitForFrame(errorRender.output, 0, (candidate) => plain(candidate).includes('接口超时'))
    expect(plain(frame)).toContain(t('dialogStockDetail.hint'))
  } finally {
    await unmountApp(errorRender.instance)
  }

  resetStores()
  openDetail({ status: 'ready', points: [] })
  const emptyRender = renderDetail()

  try {
    const frame = await waitForFrame(emptyRender.output, 0, (candidate) =>
      plain(candidate).includes(t('dialogStockDetail.empty', { period: t('chart.period.intraday') })),
    )
    expect(plain(frame)).toContain('sh600000')
  } finally {
    await unmountApp(emptyRender.instance)
    resetStores()
  }
})

test('详情弹窗有数据时渲染图表而不是空提示', async () => {
  resetStores()
  openDetail({
    status: 'ready',
    points: [
      { time: '0930', price: 10, volume: 100 },
      { time: '1500', price: 11, volume: 300 },
    ],
  })
  const { output, instance } = renderDetail()

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('浦发银行'))
    const text = plain(frame)
    expect(text).not.toContain(t('dialogStockDetail.empty', { period: t('chart.period.intraday') }))
    expect(text).toContain('sh600000')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('详情弹窗数字键切换周期, esc 关闭', async () => {
  resetStores()
  openDetail()
  const { output, input, instance } = renderDetail()

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes('浦发银行'))

    // ctrl 组合键与非周期数字键都不切换周期
    input.write('\x01')
    await waitForInput()
    input.write('9')
    await waitForInput()
    expect(useDialogStockDetailStore.getState().period).toBe('intraday')
    expect(useDialogStockDetailStore.getState().code).toBe('sh600000')

    input.write('2')
    await waitForState(() => useDialogStockDetailStore.getState().period === 'five-day')
    input.write('6')
    await waitForState(() => useDialogStockDetailStore.getState().period === 'year')

    input.write('\x1B')
    await waitForState(() => useDialogStockDetailStore.getState().code === undefined)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('详情弹窗停牌显示停牌文案, 行情缺失时显示占位', async () => {
  resetStores()
  openDetail({ status: 'ready', points: [] })
  useStockListStore.setState({
    step: {
      type: 'table',
      rows: [{ kind: 'quote', code: 'sh600000', quote: quote({ current: 0, change: 0, changePercent: 0 }) }],
    },
  })
  const suspendedRender = renderDetail()

  try {
    const frame = await waitForFrame(suspendedRender.output, 0, (candidate) =>
      plain(candidate).includes(t('common.suspended')),
    )
    expect(plain(frame)).toContain('浦发银行')
  } finally {
    await unmountApp(suspendedRender.instance)
  }

  resetStores()
  openDetail({ status: 'ready', points: [] })
  useStockListStore.setState({ step: { type: 'table', rows: [] } })
  const missingRender = renderDetail()

  try {
    const frame = await waitForFrame(missingRender.output, 0, (candidate) =>
      plain(candidate).includes(`${EMPTY_VALUE} sh600000`),
    )
    expect(plain(frame)).toContain(EMPTY_VALUE)
  } finally {
    await unmountApp(missingRender.instance)
    resetStores()
  }
})
