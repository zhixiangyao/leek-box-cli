import { expect, test } from 'vitest'

import { t } from '../src/i18n/core.ts'
import { MENU_ITEMS } from '../src/navigation/menu.ts'
import { COMMAND_LIST } from '../src/navigation/registry.ts'

test('MENU_ITEMS 覆盖全部命令加 reset/exit, 且没有重复项', () => {
  expect(MENU_ITEMS.map((item) => item.type)).toStrictEqual([...COMMAND_LIST, 'reset', 'exit'])
  expect(new Set(MENU_ITEMS.map((item) => item.type)).size).toBe(MENU_ITEMS.length)
})

test('MENU_ITEMS 每项都有非空文案', () => {
  for (const item of MENU_ITEMS) {
    expect(t(item.label).length, item.type).toBeGreaterThan(0)
  }
})
