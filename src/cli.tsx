import { render } from 'ink'
import meow from 'meow'

import App from './app.tsx'
import { SCREEN_LIST, SCREEN_REGISTRY, toScreen } from './lib/registry.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

const commandHelp = Object.entries(SCREEN_REGISTRY)
  .map(([command, definition]) => `  ${command.padEnd(13)}${definition.description}`)
  .join('\n')

const helpMessage = `
用法
  $ leek-box-cli [command]

命令
${commandHelp}

选项
  -v, --version  查看版本
  -h, --help     查看帮助
`

const cli = meow(helpMessage, {
  importMeta: import.meta,
  commands: SCREEN_LIST,
  flags: {
    help: { type: 'boolean', shortFlag: 'h' },
    version: { type: 'boolean', shortFlag: 'v' },
  },
})

// render 前写入初始页
useRouterStore.setState({ screen: toScreen(cli.command) })

render(<App />, { alternateScreen: true, concurrent: true })
