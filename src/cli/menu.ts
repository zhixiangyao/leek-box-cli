import type { MessageKey } from '../i18n/types.ts'
import { type Screen, SCREEN_REGISTRY_ENTRIES } from './registry.ts'

export type Item = { type: Screen | 'exit' | 'reset'; label: MessageKey }

export const ITEMS: Item[] = [
  ...SCREEN_REGISTRY_ENTRIES.map<Item>(([screen, definition]) => ({
    type: screen,
    label: definition.menuLabel,
  })),
  { type: 'reset', label: 'menu.reset' },
  { type: 'exit', label: 'menu.exit' },
]
