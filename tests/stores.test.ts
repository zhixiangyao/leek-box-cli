import { setTimeout as delay } from 'node:timers/promises'

import { expect, test } from 'vitest'

import type { IntradayPoint, Quote, QuoteName } from '../src/api/types.ts'
import { yesNoErrorMessage } from '../src/lib/yesNo.ts'
import type { StockEntry } from '../src/settings/schema.ts'
import { createDialogRemoveConfirmStore } from '../src/stores/useDialogRemoveConfirmStore.ts'
import { createDialogStockDetailStore } from '../src/stores/useDialogStockDetailStore.ts'
import { createStockAddStore, type StockAddDependencies } from '../src/stores/useStockAddStore.ts'
import { createStockListStore } from '../src/stores/useStockListStore.ts'
import {
  createStockRemoveStore,
  type StockRemoveDependencies,
  type StockRemoveEntry,
} from '../src/stores/useStockRemoveStore.ts'

const entry = (code: string): StockEntry => ({ code, addedAt: '2026-08-20T00:00:00.000Z' })

/** 删除网格/确认弹窗的条目: 名称来自实时行情, 行情取不到时为 undefined */
const removeEntry = (code: string, name?: string): StockRemoveEntry => ({ code, name })

/** StockRemove store 默认依赖: 自选股为空, 行情按代码给出固定名称 */
const removeStore = (overrides: Partial<StockRemoveDependencies> = {}) =>
  createStockRemoveStore({
    loadStocks: async () => [],
    fetchQuoteNames: async (codes) => codes.map<QuoteName>((code) => [code, `名称${code}`]),
    ...overrides,
  })

/** StockAdd store 默认依赖: 600000/000001 可归一化, 行情全部命中 */
const addStore = (overrides: Partial<StockAddDependencies> = {}) =>
  createStockAddStore({
    stocksAdd: async () => 1,
    fetchQuotes: async (codes) => codes.map((code) => quote(code)),
    normalizeCode: (input) => (input === '600000' ? 'sh600000' : input === '000001' ? 'sz000001' : undefined),
    now: () => '2026-08-20T00:00:00.000Z',
    ...overrides,
  })

const quote = (code: string, name = code): Quote => ({
  code,
  name,
  current: 10,
  prevClose: 9,
  open: 9.5,
  high: 10.5,
  low: 9.4,
  change: 1,
  changePercent: 11.11,
  timestamp: '20260820150000',
  volume: 100,
  turnover: 200,
  turnoverRate: 1,
  amplitude: 2,
  marketCap: 300,
  volumeRatio: 1.2,
})

test('添加股票时批量报告最终加锁写入发现的重复项', async () => {
  const entries: StockEntry[][] = []
  const store = createStockAddStore({
    stocksAdd: async (stocks) => {
      entries.push(stocks)
      return 1
    },
    fetchQuotes: async (codes) => codes.map((code) => quote(code, code === 'sh600000' ? '浦发银行' : '平安银行')),
    normalizeCode: (input) => (input === '600000' ? 'sh600000' : input === '000001' ? 'sz000001' : undefined),
    now: () => '2026-08-20T00:00:00.000Z',
  })

  await store.getState().handleCodeInput('600000, 000001')
  expect(store.getState().step.type).toBe('confirm')
  await store.getState().handleConfirm('y')
  // 确认阶段展示的名称与现价来自行情, 写进自选股的只有代码
  expect(entries).toStrictEqual([[entry('sh600000'), entry('sz000001')]])
  expect(store.getState().step).toStrictEqual({
    type: 'done',
    message: '已添加 1 个股票, 1 个已在自选股中.',
  })
})

test('StockRemove store 按文件里的代码顺序加载网格, 名称取自实时行情', async () => {
  const store = removeStore({
    loadStocks: async () => [entry('sz000001'), entry('sh600000'), entry('sz300001')],
    fetchQuoteNames: async (): Promise<QuoteName[]> => [
      ['sz000001', '平安银行'],
      ['sh600000', '浦发银行'],
    ],
  })

  await store.getState().loadEntries()
  // 行情只返回了两个代码的名称, sz300001 该条目只有代码
  expect(store.getState().entries).toStrictEqual([
    removeEntry('sz000001', '平安银行'),
    removeEntry('sh600000', '浦发银行'),
    removeEntry('sz300001'),
  ])
})

test('StockRemove store 按代码移除条目并递增 resetToken', async () => {
  const store = removeStore({
    loadStocks: async () => [entry('sz000001'), entry('sh600000'), entry('sz300001')],
  })

  await store.getState().loadEntries()
  const token = store.getState().resetToken
  store.getState().removeByCodes(['sz000001', 'sz300001'])
  expect(store.getState().entries.map((entry) => entry.code)).toStrictEqual(['sh600000'])
  expect(store.getState().resetToken).toBe(token + 1)
})

test('DialogRemoveConfirm store 确认后删除并通过回调通知调用方', async () => {
  const entries = [removeEntry('sz000001', '平安银行'), removeEntry('sh600000', '浦发银行')]
  const calls: string[][] = []
  const committed: string[][] = []
  const store = createDialogRemoveConfirmStore({
    stocksRemove: async (codes) => {
      calls.push(codes)
      return codes.length
    },
  })

  store.getState().open(entries)
  expect(store.getState().step.type).toBe('confirm')
  expect(store.getState().entries).toStrictEqual(entries)

  await store.getState().confirmDelete((codes) => committed.push(codes))
  expect(calls).toStrictEqual([['sz000001', 'sh600000']])
  expect(committed).toStrictEqual([['sz000001', 'sh600000']])
  expect(store.getState().step.type).toBe('idle')
  expect(store.getState().entries).toStrictEqual([])
})

test('DialogRemoveConfirm store 空提交被忽略', () => {
  const store = createDialogRemoveConfirmStore({ stocksRemove: async () => 0 })

  store.getState().open([])
  expect(store.getState().step.type).toBe('idle')
})

test('DialogRemoveConfirm store 取消时仅关闭弹窗, 保留网格勾选', () => {
  const store = createDialogRemoveConfirmStore({ stocksRemove: async () => 0 })

  store.getState().open([removeEntry('sz000001', '平安银行')])
  expect(store.getState().step.type).toBe('confirm')
  store.getState().close()
  expect(store.getState().step.type).toBe('idle')
  expect(store.getState().entries).toStrictEqual([])
})

test('StockRemove store 加载失败时记录错误信息, 重试成功后清空', async () => {
  let fails = true
  const store = removeStore({
    loadStocks: async () => {
      if (fails) throw new Error('配置文件损坏')
      return [entry('sh600000')]
    },
    fetchQuoteNames: async (): Promise<QuoteName[]> => [['sh600000', '浦发银行']],
  })

  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([])
  expect(store.getState().errorMessage).toBe('配置文件损坏')

  fails = false
  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
  expect(store.getState().errorMessage).toBeUndefined()
})

test('StockRemove store 先铺出代码, 行情到达后再补上名称', async () => {
  let resolveNames!: (names: [string, string][]) => void
  const store = removeStore({
    loadStocks: async () => [entry('sh600000')],
    fetchQuoteNames: () =>
      new Promise<[string, string][]>((resolve) => {
        resolveNames = resolve
      }),
  })

  const pending = store.getState().loadEntries()
  // 行情还没回来: 网格已经可以勾选, 只是单元格还没有名称
  await delay(0)
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000')])

  resolveNames([['sh600000', '浦发银行']])
  await pending
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
})

test('StockRemove store 名称在途中删掉的条目不会被名称覆盖回来', async () => {
  let resolveNames!: (names: [string, string][]) => void
  const store = removeStore({
    loadStocks: async () => [entry('sz000001'), entry('sh600000')],
    fetchQuoteNames: () =>
      new Promise<[string, string][]>((resolve) => {
        resolveNames = resolve
      }),
  })

  const pending = store.getState().loadEntries()
  // 网格已经铺出代码, 用户在等名称期间删掉一条
  await delay(0)
  store.getState().removeByCodes(['sz000001'])

  resolveNames([
    ['sz000001', '平安银行'],
    ['sh600000', '浦发银行'],
  ])
  await pending
  // 名称只补到还在网格里的条目上, 已删除的不会被整表覆盖回来
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
})

test('StockRemove store 陈旧的一轮失败不会清空新一轮加载的网格', async () => {
  let rejectFirst!: (error: Error) => void
  let calls = 0
  const store = removeStore({
    loadStocks: async () => [entry('sh600000')],
    fetchQuoteNames: async (): Promise<QuoteName[]> => {
      calls += 1
      // 第一轮行情挂在超时边缘, 第二轮已经成功返回
      if (calls > 1) return [['sh600000', '浦发银行']] as [string, string][]
      return new Promise<[string, string][]>((_resolve, reject) => {
        rejectFirst = reject
      })
    },
  })

  const stale = store.getState().loadEntries()
  await delay(0)
  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])

  rejectFirst(new Error('网络错误'))
  await stale
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
  expect(store.getState().errorMessage).toBeUndefined()
})

test('StockRemove store 陈旧的一轮不会把网格退回只有代码的状态', async () => {
  let resolveFirstStocks!: (stocks: StockEntry[]) => void
  let calls = 0
  const store = removeStore({
    loadStocks: () => {
      calls += 1
      if (calls > 1) return Promise.resolve([entry('sh600000')])
      // 第一轮读到的是更早的文件内容, 且此时才回来
      return new Promise<StockEntry[]>((resolve) => {
        resolveFirstStocks = resolve
      })
    },
    fetchQuoteNames: async (): Promise<QuoteName[]> => [['sh600000', '浦发银行']] as [string, string][],
  })

  const stale = store.getState().loadEntries()
  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])

  resolveFirstStocks([entry('sz000001')])
  // 陈旧的一轮已经越过文件读取, 若它会落地, 网格这时就只剩代码 (而且是旧文件的代码)
  await delay(0)
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
  await stale
})

test('StockRemove store 行情失败时暴露错误并清空网格', async () => {
  let fails = true
  const store = removeStore({
    loadStocks: async () => [entry('sh600000')],
    fetchQuoteNames: async (): Promise<QuoteName[]> => {
      if (fails) throw new Error('网络错误')
      return [['sh600000', '浦发银行']]
    },
  })

  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([])
  expect(store.getState().errorMessage).toBe('网络错误')

  fails = false
  await store.getState().loadEntries()
  expect(store.getState().entries).toStrictEqual([removeEntry('sh600000', '浦发银行')])
  expect(store.getState().errorMessage).toBeUndefined()
})

test('DialogRemoveConfirm store 删除失败时进入 error 并可关闭', async () => {
  const store = createDialogRemoveConfirmStore({
    stocksRemove: async () => {
      throw new Error('锁超时')
    },
  })

  store.getState().open([removeEntry('sz000001', '平安银行')])
  await store.getState().confirmDelete()
  expect(store.getState().step).toStrictEqual({ type: 'error', message: '删除失败: 锁超时' })
  expect(store.getState().entries).toStrictEqual([removeEntry('sz000001', '平安银行')])

  store.getState().close()
  expect(store.getState().step.type).toBe('idle')
  expect(store.getState().entries).toStrictEqual([])
})

test('DialogRemoveConfirm store 所选条目已被其他进程删除时报告错误', async () => {
  const store = createDialogRemoveConfirmStore({ stocksRemove: async () => 0 })

  store.getState().open([removeEntry('sz000001', '平安银行'), removeEntry('sh600000', '浦发银行')])
  await store.getState().confirmDelete()
  expect(store.getState().step).toStrictEqual({ type: 'error', message: '所选 2 个条目已不在自选股中.' })
})

test('DialogRemoveConfirm store 部分条目已不在自选股时进入 done 报告已删除数量', async () => {
  const store = createDialogRemoveConfirmStore({ stocksRemove: async () => 1 })

  store.getState().open([removeEntry('sz000001', '平安银行'), removeEntry('sh600000', '浦发银行')])
  await store.getState().confirmDelete()
  expect(store.getState().step).toStrictEqual({
    type: 'done',
    message: '已删除 1 个股票, 1 个条目已不在自选股中.',
  })
  expect(store.getState().entries).toStrictEqual([])

  store.getState().close()
  expect(store.getState().step.type).toBe('idle')
})

test('股票列表保留自选股顺序, 选中代码和未变化的行情引用', async () => {
  const firstEntries = [entry('sh600000'), entry('sz000001'), entry('sz300001')]
  const secondEntries = [entry('sz300001'), entry('sz000001')]
  const thirdEntries = [entry('sz300001')]
  const entryRounds = [firstEntries, secondEntries, thirdEntries]
  let round = 0

  const store = createStockListStore({
    loadStocks: async () => entryRounds[round++]!,
    fetchQuotes: async (codes) => codes.map((code) => quote(code)),
  })

  await store.getState().refreshQuotes()
  store.getState().moveSelection(1, 1)
  const firstStep = store.getState().step
  expect(firstStep.type).toBe('table')
  if (firstStep.type !== 'table') return
  const selectedQuote = firstStep.rows[1]!.kind === 'quote' ? firstStep.rows[1]!.quote : undefined

  await store.getState().refreshQuotes()
  const secondStep = store.getState().step
  expect(secondStep.type).toBe('table')
  if (secondStep.type !== 'table') return
  expect(secondStep.rows.map((row) => row.code)).toStrictEqual(['sz300001', 'sz000001'])
  expect(store.getState().selectedCode).toBe('sz000001')
  expect(secondStep.rows[1]!.kind === 'quote' ? secondStep.rows[1]!.quote : undefined).toBe(selectedQuote)

  await store.getState().refreshQuotes()
  expect(store.getState().selectedCode).toBe('sz300001')
  expect(store.getState().scrollOffset).toBe(0)
})

test('股票详情忽略先前打开代码已完成的请求', async () => {
  let resolveOld: (points: IntradayPoint[]) => void = () => undefined
  const oldRequest = new Promise<IntradayPoint[]>((resolve) => {
    resolveOld = resolve
  })
  const newPoints = [{ time: '0930', price: 12, volume: 10 }]
  const store = createDialogStockDetailStore({
    fetchIntraday: async (code) => (code === 'sh600000' ? oldRequest : newPoints),
  })

  store.getState().open('sh600000')
  const pendingOld = store.getState().refreshChart('sh600000', 'intraday')
  store.getState().open('sz000001')
  await store.getState().refreshChart('sz000001', 'intraday')
  resolveOld([{ time: '0930', price: 10, volume: 1 }])
  await pendingOld

  expect(store.getState().points).toStrictEqual(newPoints)
  expect(store.getState().code).toBe('sz000001')
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
      codes.map((code) => (code === 'sh600000' ? quote(code, '浦发银行') : quote(code, '平安银行'))),
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
    fetchQuotes: async (codes) => codes.filter((code) => code !== 'sh600000').map((code) => quote(code)),
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
  resolveFetch([quote('sh600000', '浦发银行')])
  await pending

  expect(store.getState().step.type).toBe('input-code')
})

test('DialogRemoveConfirm store 动作仅在对应阶段生效', () => {
  const store = createDialogRemoveConfirmStore({ stocksRemove: () => new Promise(() => undefined) })

  // idle: close/confirmDelete 均无效
  store.getState().close()
  void store.getState().confirmDelete()
  expect(store.getState().step.type).toBe('idle')

  // open 只能从 idle 进入
  store.getState().open([removeEntry('sz000001')])
  store.getState().open([removeEntry('sh600000')])
  expect(store.getState().entries).toStrictEqual([removeEntry('sz000001')])
  expect(store.getState().step.type).toBe('confirm')

  // confirm 阶段 close 退出, 勾选保留在网格层
  store.getState().close()
  expect(store.getState().step.type).toBe('idle')

  // removing 阶段 close 无效, 等待删除结果
  store.getState().open([removeEntry('sz000001')])
  void store.getState().confirmDelete()
  expect(store.getState().step.type).toBe('removing')
  store.getState().close()
  expect(store.getState().step.type).toBe('removing')
})

test('StockRemove store 移除未命中的代码时列表不变但仍递增 resetToken', async () => {
  const store = removeStore({
    loadStocks: async () => [entry('sz000001'), entry('sh600000')],
    fetchQuoteNames: async (): Promise<QuoteName[]> => [
      ['sz000001', '平安银行'],
      ['sh600000', '浦发银行'],
    ],
  })
  await store.getState().loadEntries()
  const entries = store.getState().entries

  const token = store.getState().resetToken
  store.getState().removeByCodes(['sz300001'])
  expect(store.getState().entries).toStrictEqual(entries)
  expect(store.getState().resetToken).toBe(token + 1)

  store.getState().removeByCodes([])
  expect(store.getState().entries).toStrictEqual(entries)
  expect(store.getState().resetToken).toBe(token + 2)
})
