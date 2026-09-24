import process from 'node:process'

import { beforeEach, expect, test, vi } from 'vitest'

import { run, type RunDependencies } from '../src/cli/run.ts'
import { setActiveLocale, t } from '../src/i18n/core.ts'
import { DEFAULT_LOCALE } from '../src/i18n/locale.ts'
import { APP_VERSION } from '../src/lib/version.ts'
import { createDocument, DEFAULT_SETTINGS } from '../src/settings/schema.ts'

// parseCli 与 startApp 都由用例注入, 因此本文件不读 settings.json, 无需隔离 XDG_CONFIG_HOME

type CliResult = Awaited<ReturnType<RunDependencies['parseCli']>>

/** 注入给 run 的 parseCli 结果, 只写用例关心的字段 */
const cliResult = (overrides: Partial<CliResult> = {}): CliResult => ({
  settingsDocument: undefined,
  helpMessage: 'HELP',
  command: undefined,
  showHelp: false,
  showVersion: false,
  ...overrides,
})

const startApp = vi.fn(async () => {})

beforeEach(() => {
  // 文案断言必须固定语言: activeLocale 初值是 zh-hans, 但 language 默认 auto 会跟随系统语言
  setActiveLocale(DEFAULT_LOCALE)
  process.exitCode = undefined
  startApp.mockClear()
})

test('run 在 -h 时打印 help 并跳过应用启动', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await run({ parseCli: async () => cliResult({ showHelp: true }), startApp })

  expect(log).toHaveBeenCalledWith('HELP')
  expect(startApp).not.toHaveBeenCalled()
  expect(process.exitCode).toBeUndefined()
})

test('run 在 -v 时打印 APP_VERSION 并跳过应用启动', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await run({ parseCli: async () => cliResult({ showVersion: true }), startApp })

  expect(log).toHaveBeenCalledWith(APP_VERSION)
  expect(startApp).not.toHaveBeenCalled()
  expect(process.exitCode).toBeUndefined()
})

test('run 同时收到版本与 help 时只打印版本', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})

  await run({ parseCli: async () => cliResult({ showHelp: true, showVersion: true }), startApp })

  expect(log).toHaveBeenCalledTimes(1)
  expect(log).toHaveBeenCalledWith(APP_VERSION)
  expect(startApp).not.toHaveBeenCalled()
})

test('run 的一次性输出吞掉 stdout 的 EPIPE, 其它 stdout 错误照常抛出', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  // run 装的监听器不会自己卸载, 收尾时按进入用例前的快照整体还原, 免得残留影响同文件后续用例
  const existingListeners = process.stdout.listeners('error') as Array<(...args: unknown[]) => void>
  process.stdout.removeAllListeners('error')
  try {
    expect(() => process.stdout.emit('error', Object.assign(new Error('boom'), { code: 'ENOSPC' }))).toThrow('boom')

    await run({ parseCli: async () => cliResult({ showVersion: true }), startApp })

    const brokenPipe = Object.assign(new Error('broken pipe'), { code: 'EPIPE' })
    expect(() => process.stdout.emit('error', brokenPipe)).not.toThrow()
    expect(() => process.stdout.emit('error', Object.assign(new Error('boom'), { code: 'ENOSPC' }))).toThrow('boom')
  } finally {
    process.stdout.removeAllListeners('error')
    for (const listener of existingListeners) process.stdout.on('error', listener)
  }
})

test('run 把 parseCli 的 command 与文档原样传给 startApp', async () => {
  const settingsDocument = createDocument(DEFAULT_SETTINGS, [])

  await run({ parseCli: async () => cliResult({ settingsDocument, command: 'stock-add' }), startApp })

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
    parseCli: async () => cliResult(),
    startApp: async () => {
      throw new Error('render failed')
    },
  })

  expect(errorLog).toHaveBeenCalledWith(t('app.runFailed', { error: 'render failed' }))
  expect(process.exitCode).toBe(1)
})
