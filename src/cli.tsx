import { render } from 'ink'
import meow from 'meow'

import App from './app.tsx'
import { useRouterStore, type Screen } from './stores/router.ts'

const COMMANDS = ['dashboard', 'add-stock', 'remove-stock'] as const satisfies readonly Exclude<Screen, 'menu'>[]

const helpMessage = `
用法
  $ leek-box-cli [command]

命令
  dashboard     股票涨跌看板 (默认, 自动刷新)
  add-stock     添加自选股
  remove-stock  删除自选股

选项
  -v, --version  查看版本
  -h, --help     查看帮助
`

const cli = meow(helpMessage, {
  importMeta: import.meta,
  commands: COMMANDS,
  flags: {
    help: { type: 'boolean', shortFlag: 'h' },
    version: { type: 'boolean', shortFlag: 'v' },
  },
})

const screenFromCommand = (command: string | undefined): Screen =>
  command && COMMANDS.includes(command as (typeof COMMANDS)[number])
    ? (command as (typeof COMMANDS)[number])
    : 'dashboard'

// store 是路由状态唯一来源, render 前写入初始页
useRouterStore.setState({ screen: screenFromCommand(cli.command) })

render(<App />, { alternateScreen: true, concurrent: true })
