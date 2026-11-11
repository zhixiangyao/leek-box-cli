import { expect, test } from 'vitest'

import { useDialogConfirmStore } from '../src/stores/useDialogConfirmStore.ts'

const config = {
  title: '确认重置吗?',
  content: '此操作将重置所有设置与自选股为默认值.',
  isError: false,
  confirm: async () => undefined,
}

test('open 写入配置, update 合并字段, close 清空', () => {
  const store = useDialogConfirmStore
  store.setState(store.getInitialState(), true)

  store.getState().open(config)
  expect(store.getState().config).toStrictEqual(config)

  store.getState().update({ content: '重置失败: 锁超时', isError: true })
  expect(store.getState().config).toStrictEqual({
    ...config,
    content: '重置失败: 锁超时',
    isError: true,
  })

  store.getState().close()
  expect(store.getState().config).toBeUndefined()
})

test('没有打开的配置时 update 不创建配置', () => {
  const store = useDialogConfirmStore
  store.setState(store.getInitialState(), true)

  store.getState().update({ content: '无主的更新' })

  expect(store.getState().config).toBeUndefined()
})
