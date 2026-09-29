import { expect, test } from 'vitest'

import { errorMessage } from '../src/lib/error.ts'

test('errorMessage 提取 Error 的消息, 否则转为字符串', () => {
  expect(errorMessage(new Error('接口超时'))).toBe('接口超时')
  expect(errorMessage('纯文本错误')).toBe('纯文本错误')
  expect(errorMessage(404)).toBe('404')
  expect(errorMessage(undefined)).toBe('undefined')
})
