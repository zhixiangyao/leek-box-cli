import meow from 'meow'

import { applyLanguage, t } from '../i18n/core.ts'
import { DEFAULT_LANGUAGE } from '../i18n/locale.ts'
import { loadExistingSettings } from '../settings/file.ts'
import type { SettingsDocument } from '../settings/schema.ts'
import { SCREEN_LIST, SCREEN_REGISTRY_ENTRIES } from './registry.ts'

/**
 * 读取已有配置用于确定语言, 缺失或损坏一律按"无配置"处理:
 * 这里在 main 的 try 之外, 抛出会变成顶层 await 的未处理拒绝并让 -h 也失败,
 * 因此损坏文件的报错留给后面的 initializeSettings, 由 main 统一给出用户提示.
 */
const tryLoadSettings = async (): Promise<SettingsDocument | undefined> => {
  try {
    return await loadExistingSettings()
  } catch {
    return undefined
  }
}

export function genCliHelpMessage(): string {
  const commandHelp = SCREEN_REGISTRY_ENTRIES.map(
    ([command, definition]) => `  ${command.padEnd(13)}${t(definition.description)}`,
  ).join('\n')

  return `${t('cli.usage')}
  $ leek-box-cli [command]

${t('cli.commands')}
${commandHelp}

${t('cli.options')}
  -v, --version  ${t('cli.version')}
  -h, --help     ${t('cli.help')}`
}

/** 解析 CLI 参数 */
export async function parseCli() {
  const settingsDocument = await tryLoadSettings()
  applyLanguage(settingsDocument?.language ?? DEFAULT_LANGUAGE)
  // help 文案必须在 meow() 之前生成
  const cliHelpMessage = genCliHelpMessage()
  const cli = meow(cliHelpMessage, {
    importMeta: import.meta,
    commands: [...SCREEN_LIST],
    description: false,
    autoHelp: false,
    helpIndent: 0,
    flags: {
      help: { type: 'boolean', shortFlag: 'h' },
      version: { type: 'boolean', shortFlag: 'v' },
    },
  })
  const command = cli.command
  const inputHasHelpFlag = cli.input.some((argv) => ['--help', '-h'].includes(argv))
  const showHelp = cli.flags.help === true || inputHasHelpFlag

  return { settingsDocument, cliHelpMessage, command, showHelp }
}
