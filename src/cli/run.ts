import process from 'node:process'

import { t } from '../i18n/core.ts'
import { errorMessage } from '../lib/error.ts'
import type { SettingsDocument } from '../settings/schema.ts'
import { parseCli } from './meow.ts'

export type StartAppParams = {
  settingsDocument?: SettingsDocument
  command?: string
}

export type StartApp = (params: StartAppParams) => Promise<void>

export type RunDependencies = {
  parseCli: typeof parseCli
  startApp: StartApp
}

/**
 * stdout 上的 EPIPE 是异步 'error' 事件 (下游 `-h | head` 关掉管道), 接不到 try/catch.
 * 只装给一次性的 help 输出: 应用启动路径不装, 免得 TUI 在 stdout 断开后一直挂着.
 */
const ignoreBrokenPipe = (error: NodeJS.ErrnoException): void => {
  if (error.code !== 'EPIPE') throw error
}

const printHelpIgnoringBrokenPipe = (helpMessage: string): void => {
  process.stdout.on('error', ignoreBrokenPipe)
  console.log(helpMessage)
}

/**
 * 入口顶层: parseCli 与 startApp 的异常在这里统一报成 "运行失败" 并置退出码,
 * 让 -h 与启动失败走同一条提示 (抛到模块顶层只会打印原始堆栈).
 */
export const run = async ({ parseCli, startApp }: RunDependencies): Promise<void> => {
  try {
    const { settingsDocument, helpMessage, command, showHelp } = await parseCli()
    if (showHelp) {
      printHelpIgnoringBrokenPipe(helpMessage)
      return
    }
    await startApp({ settingsDocument, command })
  } catch (error) {
    console.error(t('app.runFailed', { error: errorMessage(error) }))
    process.exitCode = 1
  }
}
