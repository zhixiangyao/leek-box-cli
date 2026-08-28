import { expect, test } from 'vitest'

import { errorMessage } from '../src/lib/error.ts'
import { parseYn } from '../src/lib/yn.ts'

test('parseYn 接受大小写的 y/n 并忽略首尾空白', () => {
  expect(parseYn('y')).toBe('y')
  expect(parseYn('Y')).toBe('y')
  expect(parseYn('  n ')).toBe('n')
  expect(parseYn('N')).toBe('n')
})

test('parseYn 对其他输入返回 undefined', () => {
  expect(parseYn('yes')).toBeUndefined()
  expect(parseYn('')).toBeUndefined()
  expect(parseYn('1')).toBeUndefined()
})

test('errorMessage 提取 Error 的消息, 否则转为字符串', () => {
  expect(errorMessage(new Error('接口超时'))).toBe('接口超时')
  expect(errorMessage('纯文本错误')).toBe('纯文本错误')
  expect(errorMessage(404)).toBe('404')
  expect(errorMessage(undefined)).toBe('undefined')
})
