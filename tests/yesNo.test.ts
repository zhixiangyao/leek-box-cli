import { expect, test } from 'vitest'

import { errorMessage } from '../src/lib/error.ts'
import { parseYesNo } from '../src/lib/yesNo.ts'

test('parseYesNo 接受大小写的 y/n 并忽略首尾空白', () => {
  expect(parseYesNo('y')).toBe('y')
  expect(parseYesNo('Y')).toBe('y')
  expect(parseYesNo('  n ')).toBe('n')
  expect(parseYesNo('N')).toBe('n')
})

test('parseYesNo 对其他输入返回 undefined', () => {
  expect(parseYesNo('yes')).toBeUndefined()
  expect(parseYesNo('')).toBeUndefined()
  expect(parseYesNo('1')).toBeUndefined()
})

test('errorMessage 提取 Error 的消息, 否则转为字符串', () => {
  expect(errorMessage(new Error('接口超时'))).toBe('接口超时')
  expect(errorMessage('纯文本错误')).toBe('纯文本错误')
  expect(errorMessage(404)).toBe('404')
  expect(errorMessage(undefined)).toBe('undefined')
})
