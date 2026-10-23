import { beforeEach, expect, test } from 'vitest'

import { useInputFocusStore } from '../src/stores/useInputFocusStore.ts'

beforeEach(() => {
  useInputFocusStore.setState(useInputFocusStore.getInitialState(), true)
})

test('聚焦计数按引用计数增减', () => {
  expect(useInputFocusStore.getState().activeCount).toBe(0)

  useInputFocusStore.getState().focus()
  useInputFocusStore.getState().focus()
  expect(useInputFocusStore.getState().activeCount).toBe(2)

  useInputFocusStore.getState().blur()
  expect(useInputFocusStore.getState().activeCount).toBe(1)
})

test('多余的 blur 不会把计数减成负数', () => {
  useInputFocusStore.getState().blur()
  expect(useInputFocusStore.getState().activeCount).toBe(0)
})
