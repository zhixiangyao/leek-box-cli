import type { MessageKey } from '../i18n/types.ts'

export type Command = 'stock-list' | 'stock-add' | 'stock-remove' | 'settings'

export type CommandComponentProps = { title: string; hint: string }

type CommandMetadata = {
  title: MessageKey
  description: MessageKey
  hint: MessageKey
  menuLabel: MessageKey
}

export const COMMAND_REGISTRY = {
  ['stock-list']: {
    title: 'command.stockList.title',
    description: 'command.stockList.description',
    hint: 'command.stockList.hint',
    menuLabel: 'command.stockList.menuLabel',
  },
  ['stock-add']: {
    title: 'command.stockAdd.title',
    description: 'command.stockAdd.description',
    hint: 'command.stockAdd.hint',
    menuLabel: 'command.stockAdd.menuLabel',
  },
  ['stock-remove']: {
    title: 'command.stockRemove.title',
    description: 'command.stockRemove.description',
    hint: 'command.stockRemove.hint',
    menuLabel: 'command.stockRemove.menuLabel',
  },
  ['settings']: {
    title: 'command.settings.title',
    description: 'command.settings.description',
    hint: 'command.settings.hint',
    menuLabel: 'command.settings.menuLabel',
  },
} satisfies Record<Command, CommandMetadata>

export const COMMAND_LIST = Object.keys(COMMAND_REGISTRY) as readonly Command[]

export const DEFAULT_COMMAND = 'stock-list' satisfies Command

export const COMMAND_REGISTRY_ENTRIES = COMMAND_LIST.map<[Command, CommandMetadata]>((command) => [
  command,
  COMMAND_REGISTRY[command],
])

export const isCommand = (value: string | undefined): value is Command =>
  !!value && COMMAND_LIST.includes(value as Command)

export const toCommand = (value: string | undefined): Command => (isCommand(value) ? value : DEFAULT_COMMAND)
