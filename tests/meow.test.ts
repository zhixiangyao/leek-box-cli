import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

import { afterAll, beforeAll, expect, test } from 'vitest'

import { genHelpMessage, parseCli } from '../src/cli/meow.ts'
import { createTranslator, getActiveLocale, t } from '../src/i18n/core.ts'
import { detectLocale } from '../src/i18n/locale.ts'
import { COMMAND_REGISTRY_ENTRIES } from '../src/navigation/registry.ts'
import { settingsPath } from '../src/settings/file.ts'
import { createDocument, DEFAULT_SETTINGS } from '../src/settings/schema.ts'

let configHome: string
let previousConfigHome: string | undefined

/** 写入设置文件内容, 供各用例切换配置状态 */
const writeSettings = async (content: string) => {
  await mkdir(dirname(settingsPath()), { recursive: true })
  await writeFile(settingsPath(), content, 'utf8')
}

/** 语言为 en 的合法配置 */
const validSettings = () => JSON.stringify(createDocument({ ...DEFAULT_SETTINGS, language: 'en' }, []))

beforeAll(async () => {
  configHome = await mkdtemp(join(tmpdir(), 'leek-box-cli-meow-'))
  previousConfigHome = process.env['XDG_CONFIG_HOME']
  process.env['XDG_CONFIG_HOME'] = configHome

  await writeSettings(validSettings())
})

afterAll(async () => {
  if (previousConfigHome === undefined) delete process.env['XDG_CONFIG_HOME']
  else process.env['XDG_CONFIG_HOME'] = previousConfigHome
  await rm(configHome, { recursive: true, force: true })
})

test('genHelpMessage 列出全部注册命令及其描述', () => {
  const help = genHelpMessage()
  for (const [command, { description }] of COMMAND_REGISTRY_ENTRIES) {
    expect(help).toContain(command)
    expect(help).toContain(t(description))
  }
  expect(help).toContain('--help')
  expect(help).toContain('--version')
})

/** 在指定 argv 下解析一次 CLI 参数, 并恢复原始 argv */
const parseWithArgv = async (...argv: string[]) => {
  const original = process.argv
  process.argv = ['node', 'main.mjs', ...argv]
  try {
    return await parseCli()
  } finally {
    process.argv = original
  }
}

test('parseCli 识别已知命令与帮助标志', async () => {
  // --version/-v 由 meow 内置处理: 打印版本后退出, 不进入 parseCli 返回值
  expect(await parseWithArgv('settings')).toMatchObject({ command: 'settings', showHelp: false })
  expect(await parseWithArgv('--help')).toMatchObject({ command: undefined, showHelp: true })
  expect(await parseWithArgv('-h')).toMatchObject({ command: undefined, showHelp: true })
})

test('parseCli 按设置文件中的 language 生成帮助文案, 供入口直接打印', async () => {
  const { helpMessage } = await parseWithArgv('--help')

  expect(getActiveLocale()).toBe('en')
  expect(helpMessage).toContain(createTranslator('en')('cli.usage'))
})

test('parseCli 回传已读到的设置文档, 供 startSettingsPersistence 复用', async () => {
  const { settingsDocument } = await parseWithArgv()

  expect(settingsDocument?.language).toBe('en')
})

test('parseCli 无命令时返回 undefined 命令, 由路由回退到默认看板', async () => {
  expect(await parseWithArgv()).toMatchObject({ command: undefined, showHelp: false })
})

test('parseCli 在设置文件损坏时不抛错, 回退系统语言并照常生成 help', async () => {
  await writeSettings('{ 无法解析')
  try {
    const { settingsDocument, helpMessage } = await parseWithArgv('--help')

    // parseCli 自身不抛: 这里抛出会命中入口的 catch, 把 -h 也变成 "运行失败".
    // 损坏文件的报错留给后面的 initializeSettings (见 tests/settings.test.ts).
    expect(settingsDocument).toBeUndefined()
    expect(getActiveLocale()).toBe(detectLocale())
    expect(helpMessage).toContain(t('cli.usage'))
  } finally {
    await writeSettings(validSettings())
  }
})
