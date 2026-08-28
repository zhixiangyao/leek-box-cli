import process from 'node:process'

import { render } from 'ink'
import meow from 'meow'

import App from './app.tsx'
import { SCREEN_LIST, SCREEN_REGISTRY, toScreen } from './lib/registry.ts'
import { startSettingsPersistence } from './lib/settingsPersistence.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

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

const cli = meow(helpMessage, {
  importMeta: import.meta,
  commands: SCREEN_LIST,
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

const main = async () => {
  const settingsPersistence = await startSettingsPersistence((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`设置保存失败: ${message}`)
  })

  try {
    // render 前写入初始页, 确保首屏和首次请求使用已加载的配置
    useRouterStore.setState({ screen: toScreen(cli.command) })
    const instance = render(<App />, { alternateScreen: true, concurrent: true })
    await instance.waitUntilExit()
  } finally {
    const persisted = await settingsPersistence.stop()
    if (!persisted) process.exitCode = 1
  }
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`运行失败: ${message}`)
  process.exitCode = 1
}
