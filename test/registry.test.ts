import { expect, test } from 'vitest'

import { isScreen, SCREEN_LIST, SCREEN_REGISTRY, toScreen } from '../src/cli/registry.ts'

test('SCREEN_LIST 与注册表键保持一致', () => {
  expect(SCREEN_LIST).toStrictEqual(['stock-list', 'stock-add', 'stock-remove', 'settings'])
})

test('每个屏幕都定义了组件与展示文案', () => {
  for (const screen of SCREEN_LIST) {
    const definition = SCREEN_REGISTRY[screen]
    expect(typeof definition.Component).toBe('function')
    expect(definition.title.length).toBeGreaterThan(0)
    expect(definition.menuLabel.length).toBeGreaterThan(0)
    expect(definition.hint).toContain('退出(q)')
  }
})

test('isScreen 仅对已注册的屏幕名返回真', () => {
  expect(isScreen('stock-list')).toBe(true)
  expect(isScreen('settings')).toBe(true)
  expect(isScreen('unknown')).toBe(false)
  expect(isScreen(undefined)).toBe(false)
})

test('toScreen 对未知值回退到默认看板', () => {
  expect(toScreen('stock-add')).toBe('stock-add')
  expect(toScreen('unknown')).toBe('stock-list')
  expect(toScreen(undefined)).toBe('stock-list')
})
