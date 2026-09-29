import { expect, test } from 'vitest'

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
