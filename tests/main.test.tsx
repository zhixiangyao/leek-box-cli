import process from 'node:process'

import { afterEach, expect, test, vi } from 'vitest'

import type { RunDependencies, StartApp } from '../src/cli/run.ts'
import { APP_NAME } from '../src/lib/version.ts'
import { useCommandStore } from '../src/stores/useCommandStore.ts'

const mocks = vi.hoisted(() => {
  // run 在模块收集阶段就被调用, vi.fn 的调用记录会被 Vitest 在用例前清空, 因此单独计数
  const state: { startApp?: StartApp; runCalls: number } = { runCalls: 0 }
  // main 在导入时改写进程标题, 必须先于 import 记下原值; hoisted 里不能引用 import 绑定的 process
  const originalTitle = globalThis.process.title
  return {
    state,
    originalTitle,
    run: vi.fn(async (dependencies: RunDependencies) => {
      state.runCalls += 1
      state.startApp = dependencies.startApp
    }),
    render: vi.fn(),
    startSettingsPersistence: vi.fn(),
  }
})

vi.mock('../src/cli/run.ts', () => ({ run: mocks.run }))
vi.mock('ink', () => ({ render: mocks.render }))
vi.mock('../src/app.tsx', () => ({ default: () => null }))
vi.mock('../src/settings/persistence.ts', () => ({ startSettingsPersistence: mocks.startSettingsPersistence }))

// 静态导入: main 的顶层 await 在收集阶段完成, 不在用例运行到一半时再求值模块
import '../src/main.tsx'

afterEach(() => {
  useCommandStore.setState(useCommandStore.getInitialState(), true)
  process.title = mocks.originalTitle
  process.exitCode = undefined
})

const startApp = () => {
  const captured = mocks.state.startApp
  if (!captured) throw new Error('main did not pass startApp to run')
  return captured
}

test('main 设置进程标题并把 startApp 交给 run', () => {
  expect(process.title).toBe(APP_NAME)
  expect(mocks.state.runCalls).toBe(1)
  expect(startApp()).toBeTypeOf('function')
})

test('startApp 写入初始命令并以 alternate screen 启动 Ink, 退出时 flush 持久化', async () => {
  const stop = vi.fn(async () => true)
  mocks.render.mockReturnValue({ waitUntilExit: async () => undefined })
  mocks.startSettingsPersistence.mockResolvedValue({ stop })

  await startApp()({ command: 'settings' })

  expect(mocks.startSettingsPersistence).toHaveBeenCalledWith(expect.any(Function), undefined)
  expect(useCommandStore.getState().command).toBe('settings')
  expect(mocks.render).toHaveBeenCalledWith(expect.anything(), {
    alternateScreen: true,
    concurrent: true,
    maxFps: 60,
  })
  expect(stop).toHaveBeenCalledTimes(1)
  expect(process.exitCode).toBeUndefined()
})

test('持久化没有成功 flush 时置退出码 1', async () => {
  mocks.render.mockReturnValue({ waitUntilExit: async () => undefined })
  mocks.startSettingsPersistence.mockResolvedValue({ stop: async () => false })

  await startApp()({})

  expect(process.exitCode).toBe(1)
})
