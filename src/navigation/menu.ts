import type { MessageKey } from '../i18n/types.ts'
import { type Command, COMMAND_REGISTRY_ENTRIES } from './registry.ts'

export type MenuItem = { type: Command | 'exit' | 'reset'; label: MessageKey }

export const MENU_ITEMS: MenuItem[] = [
  ...COMMAND_REGISTRY_ENTRIES.map<MenuItem>(([command, metadata]) => ({
    type: command,
    label: metadata.menuLabel,
  })),
  { type: 'reset', label: 'menu.reset' },
  { type: 'exit', label: 'menu.exit' },
]
