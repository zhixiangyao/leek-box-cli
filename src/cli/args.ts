import process from 'node:process'
import { parseArgs } from 'node:util'

import { applyLanguage, t } from '../i18n/core.ts'
import { DEFAULT_LANGUAGE } from '../i18n/locale.ts'
import type { Language } from '../i18n/types.ts'
import { APP_NAME } from '../lib/version.ts'
import { COMMAND_REGISTRY_ENTRIES, isCommand } from '../navigation/registry.ts'
import { loadExistingSettings } from '../settings/file.ts'
import { SchemaVersionTooNewError, type SettingsDocument } from '../settings/schema.ts'

/** 读配置不创建文件, 读不到 (缺失, 损坏或版本过新) 返回空文档, 不抛出; 一并交出渲染文案用的 language */
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
  $ ${APP_NAME} [command]

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
  // help 文案随解析结果返回: 未知命令时由 run 打印, 与 -h 共用同一份文案
  const helpMessage = genHelpMessage()

  // strict: false 时未知 flag 不阻断启动; 其后的独立值会落入位置参数, 可能被判成未知命令
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: false,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  })

  const [positionalCommand] = positionals
  const command = isCommand(positionalCommand) ? positionalCommand : undefined
  const unknownCommand = positionalCommand !== undefined && command === undefined ? positionalCommand : undefined

  const showHelp = values.help === true
  const showVersion = values.version === true

  return { settingsDocument, helpMessage, command, showHelp, showVersion, unknownCommand }
}
