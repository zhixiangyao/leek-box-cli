import type { MessageKey } from '../i18n/types.ts'
import { type Screen, SCREEN_REGISTRY_ENTRIES } from './registry.ts'

export type MenuItem = { type: Screen | 'exit' | 'reset'; label: MessageKey }

export const MENU_ITEMS: MenuItem[] = [
  ...SCREEN_REGISTRY_ENTRIES.map<MenuItem>(([screen, metadata]) => ({
    type: screen,
    label: metadata.menuLabel,
  })),
  { type: 'reset', label: 'menu.reset' },
  { type: 'exit', label: 'menu.exit' },
]
