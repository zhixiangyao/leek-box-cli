import meow from 'meow'

import { applyLanguage, t } from '../i18n/core.ts'
import { DEFAULT_LANGUAGE } from '../i18n/locale.ts'
import { COMMAND_LIST, COMMAND_REGISTRY_ENTRIES } from '../navigation/registry.ts'
import { loadExistingSettings } from '../settings/file.ts'
import type { SettingsDocument } from '../settings/schema.ts'

/** 读配置不创建文件, 读不到 (缺失或损坏) 就当没有配置: 不抛出, 报错留给后面的 initializeSettings */
const tryLoadSettings = async (): Promise<SettingsDocument | undefined> => {
  try {
    return await loadExistingSettings()
  } catch {
    return undefined
  }
}

export function genHelpMessage(): string {
  const commandHelp = COMMAND_REGISTRY_ENTRIES.map(
    ([command, { description }]) => `  ${command.padEnd(13)}${t(description)}`,
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
  // 语言要先就位: 此后任何一步抛错都由入口的 catch 报成 "运行失败", 文案按用户配置的语言渲染
  applyLanguage(settingsDocument?.language ?? DEFAULT_LANGUAGE)
  // help 文案必须在 meow() 之前生成
  const helpMessage = genHelpMessage()
  const cli = meow({
    importMeta: import.meta,
    commands: COMMAND_LIST,
    description: false,
    autoHelp: false,
    help: helpMessage,
    helpIndent: 0,
    flags: {
      help: { type: 'boolean', shortFlag: 'h' },
      version: { type: 'boolean', shortFlag: 'v' },
    },
  })
  const command = cli.command
  const inputHasHelpFlag = cli.input.some((argv) => ['--help', '-h'].includes(argv))
  const showHelp = cli.flags.help === true || inputHasHelpFlag

  return { settingsDocument, helpMessage, command, showHelp }
}
