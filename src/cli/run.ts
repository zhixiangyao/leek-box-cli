import process from 'node:process'

import { t } from '../i18n/core.ts'
import { errorMessage } from '../lib/error.ts'
import { APP_VERSION } from '../lib/version.ts'
import { COMMAND_LIST } from '../navigation/registry.ts'
import type { SettingsDocument } from '../settings/schema.ts'
import { parseCli } from './args.ts'

export type StartAppParams = {
  settingsDocument?: SettingsDocument
  command?: string
}

export type StartApp = (params: StartAppParams) => Promise<void>

export type RunDependencies = {
  parseCli: typeof parseCli
  startApp: StartApp
}

/** stdout 的 'error' 监听: 吞掉 EPIPE, 其它错误照常抛出 */
const ignoreBrokenPipe = (error: NodeJS.ErrnoException): void => {
  if (error.code !== 'EPIPE') throw error
}

const printOnceIgnoringBrokenPipe = (text: string): void => {
  process.stdout.on('error', ignoreBrokenPipe)
  console.log(text)
}

/** 入口顶层: parseCli 与 startApp 的异常统一报成 "运行失败" 并置退出码 */
export const run = async ({ parseCli, startApp }: RunDependencies): Promise<void> => {
  try {
    const { settingsDocument, helpMessage, command, showHelp, showVersion, unknownCommand } = await parseCli()
    // 未知命令优先于 -h/-v: 参数里出现未知命令时不会被 help/version 掩盖
    if (unknownCommand !== undefined) {
      console.error(t('cli.unknownCommand', { command: unknownCommand }))
      console.error(t('cli.availableCommands', { commands: COMMAND_LIST.join(', ') }))
      printOnceIgnoringBrokenPipe(helpMessage)
      process.exitCode = 2
      return
    }
    // version 先于 help
    if (showVersion) {
      printOnceIgnoringBrokenPipe(APP_VERSION)
      return
    }
    if (showHelp) {
      printOnceIgnoringBrokenPipe(helpMessage)
      return
    }
    await startApp({ settingsDocument, command })
  } catch (error) {
    console.error(t('app.runFailed', { error: errorMessage(error) }))
    process.exitCode = 1
  }
}
