import { expect, test } from 'vitest'

import { cliHelpMessage, parseCli } from '../src/cli/meow.ts'
import { SCREEN_REGISTRY_ENTRIES } from '../src/cli/registry.ts'

test('cliHelpMessage 列出全部注册命令及其描述', () => {
  for (const [command, definition] of SCREEN_REGISTRY_ENTRIES) {
    expect(cliHelpMessage).toContain(command)
    expect(cliHelpMessage).toContain(definition.description)
  }
  expect(cliHelpMessage).toContain('--help')
  expect(cliHelpMessage).toContain('--version')
})

/** 在指定 argv 下解析一次 CLI 参数, 并恢复原始 argv */
const parseWithArgv = (...argv: string[]) => {
  const original = process.argv
  process.argv = ['node', 'main.mjs', ...argv]
  try {
    return parseCli()
  } finally {
    process.argv = original
  }
}

test('parseCli 识别已知命令与帮助标志', () => {
  // --version/-v 由 meow 内置处理: 打印版本后退出, 不进入 parseCli 返回值
  expect(parseWithArgv('settings')).toStrictEqual({ command: 'settings', showHelp: false })
  expect(parseWithArgv('--help')).toStrictEqual({ command: undefined, showHelp: true })
  expect(parseWithArgv('-h')).toStrictEqual({ command: undefined, showHelp: true })
})

test('parseCli 无命令时返回 undefined 命令, 由路由回退到默认看板', () => {
  expect(parseWithArgv()).toStrictEqual({ command: undefined, showHelp: false })
})
