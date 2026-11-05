import process from 'node:process'

import { render } from 'ink'

import App from './app.tsx'
import { parseCli } from './cli/args.ts'
import { run, type StartAppParams } from './cli/run.ts'
import { t } from './i18n/core.ts'
import { errorMessage } from './lib/error.ts'
import { APP_NAME } from './lib/version.ts'
import { toCommand } from './navigation/registry.ts'
import { startSettingsPersistence } from './settings/persistence.ts'
import { useCommandStore } from './stores/useCommandStore.ts'
import './lib/polyfill.ts'

async function startApp(params: StartAppParams) {
  const { settingsDocument, command } = params
  const settingsPersistence = await startSettingsPersistence(
    (error) => console.error(t('app.persistenceFailed', { error: errorMessage(error) })),
    settingsDocument,
  )

  try {
    useCommandStore.setState({ command: toCommand(command) })
    const instance = render(<App />, {
      alternateScreen: true,
      concurrent: true,
      maxFps: 60,
    })
    await instance.waitUntilExit()
  } finally {
    const persisted = await settingsPersistence.stop()
    if (!persisted) process.exitCode = 1
  }
}

// 进程标题, 只影响进程列表显示
process.title = APP_NAME
await run({ parseCli, startApp })
