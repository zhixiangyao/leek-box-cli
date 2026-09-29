import { expect, test } from 'vitest'

import type { Quote } from '../src/api/types.ts'
import { yesNoErrorMessage } from '../src/lib/yesNo.ts'
import type { StockEntry } from '../src/settings/schema.ts'
import { createStockAddStore, type StockAddDependencies } from '../src/stores/useStockAddStore.ts'
import { quote, stockEntry } from './helpers/fixtures.ts'

/** StockAdd store 默认依赖: 600000/000001 可归一化, 行情全部命中 */
const addStore = (overrides: Partial<StockAddDependencies> = {}) =>
  createStockAddStore({
    stocksAdd: async () => 1,
    fetchQuotes: async (codes) => codes.map((code) => quote({ code, name: code })),
    normalizeCode: (input) => (input === '600000' ? 'sh600000' : input === '000001' ? 'sz000001' : undefined),
    now: () => '2026-08-20T00:00:00.000Z',
    ...overrides,
  })

test('添加股票时批量报告最终加锁写入发现的重复项', async () => {
  const entries: StockEntry[][] = []
  const store = createStockAddStore({
    stocksAdd: async (stocks) => {
      entries.push(stocks)
      return 1
    },
    fetchQuotes: async (codes) =>
      codes.map((code) => quote({ code, name: code === 'sh600000' ? '浦发银行' : '平安银行' })),
    normalizeCode: (input) => (input === '600000' ? 'sh600000' : input === '000001' ? 'sz000001' : undefined),
    now: () => '2026-08-20T00:00:00.000Z',
  })

  await store.getState().handleCodeInput('600000, 000001')
  expect(store.getState().step.type).toBe('confirm')
  await store.getState().handleConfirm('y')
  // 确认阶段展示的名称与现价来自行情, 写进自选股的只有代码
  expect(entries).toStrictEqual([[stockEntry('sh600000'), stockEntry('sz000001')]])
  expect(store.getState().step).toStrictEqual({
    type: 'done',
    message: '已添加 1 个股票, 1 个已在自选股中.',
  })
})

test('StockAdd store 空输入或无法识别的代码记录错误并重挂载输入框', async () => {
  const store = addStore()

  await store.getState().handleCodeInput(' , ')
  expect(store.getState().step.type).toBe('input-code')
  expect(store.getState().codeInput.error).toBe('无法识别股票代码, 请用英文逗号分隔 6 位股票代码.')

  const token = store.getState().codeInput.resetToken
  await store.getState().handleCodeInput('abc')
  expect(store.getState().codeInput.error).toBe('无法识别股票代码, 请用英文逗号分隔 6 位股票代码.')
  expect(store.getState().codeInput.resetToken).toBe(token + 1)
})

test('StockAdd store 重复输入的代码只校验并展示一份', async () => {
  const store = addStore({
    fetchQuotes: async (codes) =>
      codes.map((code) =>
        code === 'sh600000' ? quote({ code, name: '浦发银行' }) : quote({ code, name: '平安银行' }),
      ),
  })

  await store.getState().handleCodeInput('600000, 600000, 000001')
  expect(store.getState().step).toStrictEqual({
    type: 'confirm',
    entries: [
      { code: 'sh600000', name: '浦发银行', current: 10 },
      { code: 'sz000001', name: '平安银行', current: 10 },
    ],
  })
})

test('StockAdd store 行情缺失时报告未找到的代码', async () => {
  const store = addStore({
    fetchQuotes: async (codes) =>
      codes.filter((code) => code !== 'sh600000').map((code) => quote({ code, name: code })),
  })

  await store.getState().handleCodeInput('600000, 000001')
  expect(store.getState().step).toStrictEqual({ type: 'error', message: '未找到股票代码: sh600000.' })
})

test('StockAdd store 行情请求失败时进入 error', async () => {
  const store = addStore({
    fetchQuotes: async () => {
      throw new Error('接口超时')
    },
  })

  await store.getState().handleCodeInput('600000')
  expect(store.getState().step).toStrictEqual({ type: 'error', message: '接口超时' })
})

test('StockAdd store 确认阶段回答非 y/n 时提示错误并保持确认', async () => {
  const store = addStore()
  await store.getState().handleCodeInput('600000')
  expect(store.getState().step.type).toBe('confirm')

  const token = store.getState().confirmInput.resetToken
  await store.getState().handleConfirm('x')
  expect(store.getState().step.type).toBe('confirm')
  expect(store.getState().confirmInput.error).toBe(yesNoErrorMessage())
  expect(store.getState().confirmInput.resetToken).toBe(token + 1)
})

test('StockAdd store 回答 n 时取消并提示', async () => {
  const store = addStore()
  await store.getState().handleCodeInput('600000')
  await store.getState().handleConfirm('n')
  expect(store.getState().step).toStrictEqual({ type: 'done', message: '已取消.' })
})

test('StockAdd store 全部已存在时进入 already-exists', async () => {
  const store = addStore({ stocksAdd: async () => 0 })

  await store.getState().handleCodeInput('600000')
  await store.getState().handleConfirm('y')
  expect(store.getState().step).toStrictEqual({
    type: 'already-exists',
    entries: [{ code: 'sh600000', name: 'sh600000', current: 10 }],
  })
})

test('StockAdd store 写入失败时报告错误', async () => {
  const store = addStore({
    stocksAdd: async () => {
      throw new Error('锁超时')
    },
  })

  await store.getState().handleCodeInput('600000')
  await store.getState().handleConfirm('y')
  expect(store.getState().step).toStrictEqual({ type: 'error', message: '写入自选股失败: 锁超时' })
})

test('StockAdd store 非对应阶段的动作被忽略', async () => {
  const store = addStore()

  // 输入阶段调用确认无效
  await store.getState().handleConfirm('y')
  expect(store.getState().step.type).toBe('input-code')

  await store.getState().handleCodeInput('600000')
  const confirmStep = store.getState().step
  // 确认阶段调用代码输入无效
  await store.getState().handleCodeInput('000001')
  expect(store.getState().step).toStrictEqual(confirmStep)
})

test('StockAdd store reset 作废在途校验并回到输入阶段', async () => {
  let resolveFetch!: (quotes: Quote[]) => void
  const store = addStore({
    fetchQuotes: () =>
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
  })

  const pending = store.getState().handleCodeInput('600000')
  store.getState().reset()
  resolveFetch([quote({ code: 'sh600000', name: '浦发银行' })])
  await pending

  expect(store.getState().step.type).toBe('input-code')
})
