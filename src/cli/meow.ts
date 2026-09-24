import meow from 'meow'

import { applyLanguage, t } from '../i18n/core.ts'
import { DEFAULT_LANGUAGE } from '../i18n/locale.ts'
import type { Language } from '../i18n/types.ts'
import { COMMAND_LIST, COMMAND_REGISTRY_ENTRIES } from '../navigation/registry.ts'
import { loadExistingSettings } from '../settings/file.ts'
import { SchemaVersionTooNewError, type SettingsDocument } from '../settings/schema.ts'

/**
 * 读配置不创建文件, 读不到 (缺失, 损坏或版本过新) 就当没有配置: 不抛出, 报错留给后面的 initializeSettings.
 * language 一并交出来而不是留给调用方从文档里取: 版本过新时文档整体被拒绝 (读不懂的字段不能让它写掉),
 * 但紧接着要打的那句 "请升级" 得用用户配置的语言说.
 */
const tryLoadSettings = async (): Promise<{ document: SettingsDocument | undefined; language: Language }> => {
  try {
    const document = await loadExistingSettings()
    return { document, language: document?.language ?? DEFAULT_LANGUAGE }
  } catch (error) {
    const language = error instanceof SchemaVersionTooNewError ? error.language : undefined
    return { document: undefined, language: language ?? DEFAULT_LANGUAGE }
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
  const { document: settingsDocument, language } = await tryLoadSettings()
  // 语言要先就位: 此后任何一步抛错都由入口的 catch 报成 "运行失败", 文案按用户配置的语言渲染
  applyLanguage(language)
  // help 文案必须在 meow() 之前生成
  const helpMessage = genHelpMessage()
  const cli = meow({
    importMeta: import.meta,
    commands: COMMAND_LIST,
    description: false,
    autoHelp: false,
    autoVersion: false,
    help: helpMessage,
    helpIndent: 0,
    flags: {
      help: { type: 'boolean', shortFlag: 'h' },
      version: { type: 'boolean', shortFlag: 'v' },
    },
  })
  const command = cli.command
  const inputHasHelpFlag = cli.input.some((argv) => ['--help', '-h'].includes(argv))
  const inputHasVersionFlag = cli.input.some((argv) => ['--version', '-v'].includes(argv))
  const showHelp = cli.flags.help === true || inputHasHelpFlag
  const showVersion = cli.flags.version === true || inputHasVersionFlag

  return { settingsDocument, helpMessage, command, showHelp, showVersion }
}
