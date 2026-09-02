import meow from 'meow'

import { SCREEN_LIST, SCREEN_REGISTRY_ENTRIES } from './registry.ts'

const commandHelp = SCREEN_REGISTRY_ENTRIES.map(
  ([command, definition]) => `  ${command.padEnd(13)}${definition.description}`,
).join('\n')

export const cliHelpMessage = `用法
  $ leek-box-cli [command]

命令
${commandHelp}

选项
  -v, --version  查看版本
  -h, --help     查看帮助`

/** 解析 CLI 参数 */
export function parseCli() {
  const cli = meow(cliHelpMessage, {
    importMeta: import.meta,
    commands: [...SCREEN_LIST],
    description: false,
    autoHelp: false,
    helpIndent: 0,
    flags: {
      help: { type: 'boolean', shortFlag: 'h' },
      version: { type: 'boolean', shortFlag: 'v' },
    },
  })

  const inputHasHelpFlag = cli.input.some((argv) => argv === '--help' || argv === '-h')
  const showHelp = cli.flags.help === true || inputHasHelpFlag

  return { command: cli.command, showHelp }
}
