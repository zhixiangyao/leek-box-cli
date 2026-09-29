import { expect, test } from 'vitest'

import { keyDirection } from '../src/lib/keys.ts'

/** 只列出需要置位的方向键标志位, 其余按键位默认为 false */
const arrows = (pressed: Partial<Record<'upArrow' | 'downArrow' | 'leftArrow' | 'rightArrow', true>>) => ({
  upArrow: false,
  downArrow: false,
  leftArrow: false,
  rightArrow: false,
  ...pressed,
})

test('keyDirection 把方向键和 vim 键映射到同一个方向', () => {
  expect(keyDirection('', arrows({ upArrow: true }))).toBe('up')
  expect(keyDirection('', arrows({ downArrow: true }))).toBe('down')
  expect(keyDirection('', arrows({ leftArrow: true }))).toBe('left')
  expect(keyDirection('', arrows({ rightArrow: true }))).toBe('right')

  expect(keyDirection('k', arrows({}))).toBe('up')
  expect(keyDirection('j', arrows({}))).toBe('down')
  expect(keyDirection('h', arrows({}))).toBe('left')
  expect(keyDirection('l', arrows({}))).toBe('right')
})

test('keyDirection 不吞掉各界面自己的快捷键', () => {
  // q/esc/r/d/空格/数字/enter 以及大写 (shift) 字母都要留给调用方判断
  for (const input of ['q', 'd', 'r', '1', ' ', '\r', 'K', 'J', 'H', 'L']) {
    expect(keyDirection(input, arrows({})), input).toBeUndefined()
  }
})
