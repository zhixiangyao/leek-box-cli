import { type Screen, SCREEN_REGISTRY_ENTRIES } from './registry.ts'

export type Item = { type: Screen | 'exit' | 'reset'; label: string }

export const ITEMS: Item[] = [
  ...SCREEN_REGISTRY_ENTRIES.map<Item>(([screen, definition]) => ({
    type: screen,
    label: definition.menuLabel,
  })),
  { type: 'reset', label: '重置' },
  { type: 'exit', label: '退出程序' },
]
