import { PassThrough, Writable } from 'node:stream'

import { render, Text } from 'ink'
import { createElement, type ComponentType } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { usePolling } from '../src/hooks/usePolling.ts'

type Options = {
  intervalMs: number
  restartKey?: unknown
  enabled?: boolean
}

class CaptureOutput extends Writable {
  readonly columns = 40
  readonly rows = 5
  readonly isTTY = true
  readonly frames: string[] = []

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.frames.push(chunk.toString())
    callback()
  }
}

const createInput = () => {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean
    setRawMode: (mode: boolean) => PassThrough
    ref: () => PassThrough
    unref: () => PassThrough
  }
  input.isTTY = true
  input.setRawMode = () => input
  input.ref = () => input
  input.unref = () => input
  return input
}

/** 渲染 usePolling 探查器, 记录任务调用信号与错误 */
const mountPolling = (
  task: (signal: AbortSignal) => Promise<void>,
  onError: (error: unknown) => void,
  options: Options,
) => {
  let refresh: (() => void) | undefined

  const harness: ComponentType<{ opts: Options }> = ({ opts }) => {
    refresh = usePolling(task, { ...opts, onError }).refresh
    return createElement(Text, null, 'polling')
  }

  const instance = render(createElement(harness, { opts: options }), {
    stdout: new CaptureOutput() as unknown as NodeJS.WriteStream,
    stdin: createInput() as unknown as NodeJS.ReadStream,
    stderr: new PassThrough() as unknown as NodeJS.WriteStream,
    debug: true,
    interactive: false,
    patchConsole: false,
  })

  return {
    instance,
    rerender: (next: Options) => instance.rerender(createElement(harness, { opts: next })),
    refresh: () => refresh?.(),
  }
}

/** 基于真实 setImmediate 的等待, 不受 fake timers 影响 */
const waitFor = async (check: () => boolean, message = 'timed out') => {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => setImmediate(resolve))
    if (check()) return
  }
  throw new Error(message)
}

const ignoreError = () => undefined

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

test('挂载后立即执行一次并按照 interval 重复调度', async () => {
  const signals: AbortSignal[] = []
  const { instance } = mountPolling(
    async (signal) => {
      signals.push(signal)
    },
    ignoreError,
    { intervalMs: 100 },
  )

  try {
    await waitFor(() => signals.length === 1)
    await vi.advanceTimersByTimeAsync(100)
    await waitFor(() => signals.length === 2)
    await vi.advanceTimersByTimeAsync(100)
    await waitFor(() => signals.length === 3)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('任务耗时小于 interval 时只等待剩余时间', async () => {
  const signals: AbortSignal[] = []
  const { instance } = mountPolling(
    async (signal) => {
      signals.push(signal)
      const startedAt = signals.length
      await new Promise((resolve) => setTimeout(resolve, 40))
      // 仅第一次任务慢, 第二次立即完成, 避免拖长第二次调度
      if (startedAt > 1) return
    },
    ignoreError,
    { intervalMs: 100 },
  )

  try {
    await waitFor(() => signals.length === 1)
    // 任务 40ms 后完成, 初始定时器被清除, 离 interval 到点还差 60ms
    await vi.advanceTimersByTimeAsync(60)
    expect(signals).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(40)
    await waitFor(() => signals.length === 2)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('任务超过 interval 时完成后下一轮立即开始但不并发', async () => {
  const signals: AbortSignal[] = []
  let release: (() => void) | undefined
  const { instance } = mountPolling(
    async (signal) => {
      signals.push(signal)
      if (signals.length === 1) {
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
    },
    ignoreError,
    { intervalMs: 100 },
  )

  try {
    await waitFor(() => signals.length === 1)
    // 持续时间超过 interval, 期间不触发新的任务
    await vi.advanceTimersByTimeAsync(300)
    expect(signals).toHaveLength(1)

    // 完成后下一轮立即开始
    release?.()
    await vi.advanceTimersByTimeAsync(0)
    await waitFor(() => signals.length === 2)
    await vi.advanceTimersByTimeAsync(100)
    await waitFor(() => signals.length === 3)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('任务抛错时调用 onError 并继续下一轮', async () => {
  const errors: unknown[] = []
  const { instance } = mountPolling(
    async () => {
      throw new Error('接口超时')
    },
    (error) => errors.push(error),
    { intervalMs: 100 },
  )

  try {
    await waitFor(() => errors.length === 1)
    expect(errors[0]).toStrictEqual(new Error('接口超时'))
    await vi.advanceTimersByTimeAsync(100)
    await waitFor(() => errors.length === 2)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('refresh 清除定时器并立即执行, 请求中时忽略', async () => {
  const signals: AbortSignal[] = []
  let release: (() => void) | undefined
  const { instance, refresh } = mountPolling(
    async (signal) => {
      signals.push(signal)
      if (signals.length === 1) {
        await new Promise<void>((resolve) => {
          release = resolve
        })
      }
    },
    ignoreError,
    { intervalMs: 100 },
  )

  try {
    await waitFor(() => signals.length === 1)
    await vi.advanceTimersByTimeAsync(50)

    // 请求进行中, refresh 被忽略
    refresh?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(signals).toHaveLength(1)

    // 完成后 refresh 立即触发且重新计时
    release?.()
    await vi.advanceTimersByTimeAsync(0)
    refresh?.()
    await waitFor(() => signals.length === 2)
    await vi.advanceTimersByTimeAsync(100)
    await waitFor(() => signals.length === 3)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('abort 的任务不调用 onError, restartKey 变化重启并取消旧请求', async () => {
  const signals: AbortSignal[] = []
  const errors: unknown[] = []
  const { instance, rerender } = mountPolling(
    async (signal) => {
      signals.push(signal)
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    },
    (error) => errors.push(error),
    { intervalMs: 100, restartKey: 'a' },
  )

  try {
    await waitFor(() => signals.length === 1)
    rerender({ intervalMs: 100, restartKey: 'b' })
    await waitFor(() => signals.length === 2)

    expect(signals[0]!.aborted).toBe(true)
    expect(signals[1]!.aborted).toBe(false)
    expect(errors).toStrictEqual([])
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('卸载时取消当前请求并停止调度', async () => {
  const signals: AbortSignal[] = []
  const errors: unknown[] = []
  const { instance } = mountPolling(
    async (signal) => {
      signals.push(signal)
      if (signals.length === 1) {
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        })
      }
    },
    (error) => errors.push(error),
    { intervalMs: 50 },
  )

  try {
    await waitFor(() => signals.length === 1)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }

  expect(signals[0]!.aborted).toBe(true)
  expect(errors).toStrictEqual([])
  await vi.advanceTimersByTimeAsync(500)
  expect(signals).toHaveLength(1)
})

test('enabled 为 false 时不启动, 变为 true 后恢复', async () => {
  const signals: AbortSignal[] = []
  const { instance, rerender } = mountPolling(
    async (signal) => {
      signals.push(signal)
    },
    ignoreError,
    { intervalMs: 100, enabled: false },
  )

  try {
    await vi.advanceTimersByTimeAsync(200)
    expect(signals).toHaveLength(0)

    rerender({ intervalMs: 100, enabled: true })
    await waitFor(() => signals.length === 1)

    rerender({ intervalMs: 100, enabled: false })
    await vi.advanceTimersByTimeAsync(500)
    expect(signals).toHaveLength(1)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})

test('interval 变化在非请求期间重新排程', async () => {
  const signals: AbortSignal[] = []
  const { instance, rerender } = mountPolling(
    async (signal) => {
      signals.push(signal)
    },
    ignoreError,
    { intervalMs: 100 },
  )

  try {
    await waitFor(() => signals.length === 1)
    // 50ms 时调整 interval, 旧定时器被清除并从零计时 400ms
    await vi.advanceTimersByTimeAsync(50)
    rerender({ intervalMs: 400 })
    await vi.advanceTimersByTimeAsync(200)
    expect(signals).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(200)
    await waitFor(() => signals.length === 2)
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
  }
})
