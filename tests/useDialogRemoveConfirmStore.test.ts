import { expect, test } from 'vitest'

import { createDialogRemoveConfirmStore } from '../src/stores/useDialogRemoveConfirmStore.ts'
import { removeEntry } from './helpers/fixtures.ts'

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

  store.getState().open(entries, (codes) => committed.push(codes))
  expect(store.getState().step.type).toBe('confirm')
  expect(store.getState().entries).toStrictEqual(entries)

  await store.getState().confirmDelete()
  expect(calls).toStrictEqual([['sz000001', 'sh600000']])
  expect(committed).toStrictEqual([['sz000001', 'sh600000']])
  expect(store.getState().step.type).toBe('idle')
  expect(store.getState().entries).toStrictEqual([])
  expect(store.getState().onRemoved).toBeUndefined()
})

test('DialogRemoveConfirm store 打开者登记的回调只在确实删掉条目后被调用', async () => {
  const committed: string[][] = []
  const onRemoved = (codes: string[]) => committed.push(codes)
  // 所选条目都已被别的进程删掉: 一个都不算删掉, 回调不该被调用
  const missing = createDialogRemoveConfirmStore({ stocksRemove: async () => 0 })
  const failing = createDialogRemoveConfirmStore({
    stocksRemove: async () => {
      throw new Error('锁超时')
    },
  })
  // 部分条目已不在自选股: 删掉了一部分, 仍算删掉
  const partial = createDialogRemoveConfirmStore({ stocksRemove: async () => 1 })

  missing.getState().open([removeEntry('sz000001')], onRemoved)
  await missing.getState().confirmDelete()
  failing.getState().open([removeEntry('sz000001')], onRemoved)
  await failing.getState().confirmDelete()
  expect(committed).toStrictEqual([])

  partial.getState().open([removeEntry('sz000001'), removeEntry('sh600000')], onRemoved)
  await partial.getState().confirmDelete()
  expect(committed).toStrictEqual([['sz000001', 'sh600000']])
})

test('DialogRemoveConfirm store 每次打开都重置收尾动作', async () => {
  const committed: string[][] = []
  const store = createDialogRemoveConfirmStore({ stocksRemove: async (codes) => codes.length })

  store.getState().open([removeEntry('sz000001')], (codes) => committed.push(codes))
  store.getState().close()
  // 第二次打开没有登记回调: 上一次留下的不能跟过来
  store.getState().open([removeEntry('sh600000')])
  expect(store.getState().onRemoved).toBeUndefined()
  await store.getState().confirmDelete()
  expect(committed).toStrictEqual([])
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
