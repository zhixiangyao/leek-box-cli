import process from 'node:process'

import { render } from 'ink'

import App from './app.tsx'
import { parseCli } from './cli/meow.ts'
import { toScreen } from './cli/registry.ts'
import { t } from './i18n/core.ts'
import { errorMessage } from './lib/error.ts'
import { startSettingsPersistence } from './settings/persistence.ts'
import type { SettingsDocument } from './settings/schema.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

type MainParams = {
  settingsDocument?: SettingsDocument
  command?: string
}

async function main(params: MainParams) {
  const { settingsDocument, command } = params
  const settingsPersistence = await startSettingsPersistence(
    (error) => console.error(t('app.persistenceFailed', { error: errorMessage(error) })),
    settingsDocument,
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

const { settingsDocument, cliHelpMessage, command, showHelp } = await parseCli()

if (showHelp) {
  console.log(cliHelpMessage)
} else {
  try {
    await main({ settingsDocument, command })
  } catch (error) {
    console.error(t('app.runFailed', { error: errorMessage(error) }))
    process.exitCode = 1
  }
}
