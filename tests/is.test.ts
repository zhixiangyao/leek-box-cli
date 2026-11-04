import process from 'node:process'

import { expect, test, vi } from 'vitest'

import { isNormalObject, isPositive, isProcessAlive, isWindows } from '../src/lib/is.ts'

test('isNormalObject 只接受非数组的普通对象', () => {
  expect(isNormalObject({})).toBe(true)
  expect(isNormalObject({ a: 1 })).toBe(true)
  expect(isNormalObject([])).toBe(false)
  expect(isNormalObject(null)).toBe(false)
  expect(isNormalObject('text')).toBe(false)
  expect(isNormalObject(42)).toBe(false)
})

test('isPositive 对零, 负数与 NaN 返回 false', () => {
  expect(isPositive(1)).toBe(true)
  expect(isPositive(0.0001)).toBe(true)
  expect(isPositive(0)).toBe(false)
  expect(isPositive(-1)).toBe(false)
  expect(isPositive(Number.NaN)).toBe(false)
})

test('isProcessAlive 把 ESRCH 之外的 kill 错误视为进程仍存在', () => {
  expect(isProcessAlive(process.pid)).toBe(true)

  const kill = vi.spyOn(process, 'kill')
  try {
    kill.mockImplementation(() => {
      throw Object.assign(new Error('no such process'), { code: 'ESRCH' })
    })
    expect(isProcessAlive(999_999_999)).toBe(false)

    kill.mockImplementation(() => {
      throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' })
    })
    expect(isProcessAlive(1)).toBe(true)
  } finally {
    kill.mockRestore()
  }
})

test('isWindows 跟随当前平台', () => {
  expect(isWindows()).toBe(process.platform === 'win32')
})
