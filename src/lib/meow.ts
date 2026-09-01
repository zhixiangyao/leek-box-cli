import meow from 'meow'

import { SCREEN_LIST, SCREEN_REGISTRY } from './registry.ts'

const commandHelp = Object.entries(SCREEN_REGISTRY)
  .map(([command, definition]) => `  ${command.padEnd(13)}${definition.description}`)
  .join('\n')

const helpMessage = `用法
  $ leek-box-cli [command]

命令
${commandHelp}

选项
  -v, --version  查看版本
  -h, --help     查看帮助`

export const cli = meow(helpMessage, {
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

if (cli.flags.help) {
  console.log(helpMessage)
  process.exit(0)
}
