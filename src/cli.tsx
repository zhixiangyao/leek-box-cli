import process from 'node:process'

import { render } from 'ink'

import App from './app.tsx'
import { cli } from './lib/meow.ts'
import { toScreen } from './lib/registry.ts'
import { startSettingsPersistence } from './lib/settingsPersistence.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

const main = async (command: string | undefined) => {
  const settingsPersistence = await startSettingsPersistence((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`设置保存失败: ${message}`)
  })

  try {
    useRouterStore.setState({ screen: toScreen(command) })
    const instance = render(<App />, { alternateScreen: true, concurrent: true })
    await instance.waitUntilExit()
  } finally {
    const persisted = await settingsPersistence.stop()
    if (!persisted) process.exitCode = 1
  }
}

try {
  await main(cli.command)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`运行失败: ${message}`)
  process.exitCode = 1
}
