import { expect, test } from 'vitest'

import { t } from '../src/i18n/core.ts'
import { isCommand, COMMAND_LIST, COMMAND_REGISTRY, toCommand } from '../src/navigation/registry.ts'

test('COMMAND_LIST 与注册表键保持一致', () => {
  expect(COMMAND_LIST).toStrictEqual(['stock-list', 'stock-add', 'stock-remove', 'settings'])
})

test('每个命令都定义了展示文案', () => {
  for (const command of COMMAND_LIST) {
    const definition = COMMAND_REGISTRY[command]
    expect(t(definition.title).length).toBeGreaterThan(0)
    expect(t(definition.menuLabel).length).toBeGreaterThan(0)
    expect(t(definition.hint)).toContain('退出(q)')
  }
})

test('isCommand 仅对已注册的命令名返回真', () => {
  expect(isCommand('stock-list')).toBe(true)
  expect(isCommand('settings')).toBe(true)
  expect(isCommand('unknown')).toBe(false)
  expect(isCommand(undefined)).toBe(false)
})

test('toCommand 对未知值回退到默认看板', () => {
  expect(toCommand('stock-add')).toBe('stock-add')
  expect(toCommand('unknown')).toBe('stock-list')
  expect(toCommand(undefined)).toBe('stock-list')
})
