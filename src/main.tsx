import process from 'node:process'

import { render } from 'ink'

import App from './app.tsx'
import { cliHelpMessage, parseCli } from './cli/meow.ts'
import { toScreen } from './cli/registry.ts'
import { errorMessage } from './lib/error.ts'
import { startSettingsPersistence } from './settings/persistence.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

const main = async (command?: string) => {
  const settingsPersistence = await startSettingsPersistence((error) =>
    console.error(`设置保存失败: ${errorMessage(error)}`),
  )
  const termProgram = process.env['TERM_PROGRAM']
  const incrementalRendering = !!termProgram && ['kiro', 'vscode'].includes(termProgram)

  try {
    useRouterStore.setState({ screen: toScreen(command) })
    const instance = render(<App />, {
      alternateScreen: true,
      concurrent: true,
      incrementalRendering,
      maxFps: 45,
    })
    await instance.waitUntilExit()
  } finally {
    const persisted = await settingsPersistence.stop()
    if (!persisted) process.exitCode = 1
  }
}

const { command, showHelp } = parseCli()

if (showHelp) {
  console.log(cliHelpMessage)
} else {
  try {
    await main(command)
  } catch (error) {
    console.error(`运行失败: ${errorMessage(error)}`)
    process.exitCode = 1
  }
}
