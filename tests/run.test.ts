import process from 'node:process'

import { beforeEach, expect, test, vi } from 'vitest'

import { run } from '../src/cli/run.ts'
import { setActiveLocale, t } from '../src/i18n/core.ts'
import { DEFAULT_LOCALE } from '../src/i18n/locale.ts'
import { createDocument, DEFAULT_SETTINGS } from '../src/settings/schema.ts'

// parseCli 与 startApp 都由用例注入, 因此本文件不读 settings.json, 无需隔离 XDG_CONFIG_HOME

const startApp = vi.fn(async () => {})

beforeEach(() => {
  // 文案断言必须固定语言: activeLocale 初值是 zh-hans, 但 language 默认 auto 会跟随系统语言
  setActiveLocale(DEFAULT_LOCALE)
  process.exitCode = undefined
  startApp.mockClear()
})

test('run 在 -h 时打印 help 并跳过应用启动', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await run({
    parseCli: async () => ({ settingsDocument: undefined, helpMessage: 'HELP', command: undefined, showHelp: true }),
    startApp,
  })

  expect(log).toHaveBeenCalledWith('HELP')
  expect(startApp).not.toHaveBeenCalled()
  expect(process.exitCode).toBeUndefined()
})

test('run 把 parseCli 的 command 与文档原样传给 startApp', async () => {
  const settingsDocument = createDocument(DEFAULT_SETTINGS, [])

  await run({
    parseCli: async () => ({ settingsDocument, helpMessage: 'HELP', command: 'stock-add', showHelp: false }),
    startApp,
  })

  expect(startApp).toHaveBeenCalledWith({ settingsDocument, command: 'stock-add' })
  expect(process.exitCode).toBeUndefined()
})

test('run 把 parseCli 的异常报成 app.runFailed 并置退出码 1', async () => {
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

  await run({
    parseCli: async () => {
      throw new Error('bad flag')
    },
    startApp,
  })

  expect(errorLog).toHaveBeenCalledWith(t('app.runFailed', { error: 'bad flag' }))
  expect(startApp).not.toHaveBeenCalled()
  expect(process.exitCode).toBe(1)
})

test('run 把 startApp 的异常报成 app.runFailed 并置退出码 1', async () => {
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

  await run({
    parseCli: async () => ({ settingsDocument: undefined, helpMessage: 'HELP', command: undefined, showHelp: false }),
    startApp: async () => {
      throw new Error('render failed')
    },
  })

  expect(errorLog).toHaveBeenCalledWith(t('app.runFailed', { error: 'render failed' }))
  expect(process.exitCode).toBe(1)
})
