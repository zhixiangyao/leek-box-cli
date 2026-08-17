import { render } from 'ink'
import meow from 'meow'

import App from './app.tsx'
import { SCREEN_LIST, toScreen } from './lib/screens.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

const helpMessage = `
用法
  $ leek-box-cli [command]

命令
  dashboard     股票自选股看板 (默认, 自动刷新)
  add-stock     添加自选股
  remove-stock  删除自选股

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

// store 是路由状态唯一来源, render 前写入初始页
useRouterStore.setState({ screen: toScreen(cli.command) })

render(<App />, { alternateScreen: true, concurrent: true })
