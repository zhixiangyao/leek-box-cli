import { setTimeout as delay } from 'node:timers/promises'

import { Box } from 'ink'
import { createElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { Quote } from '../src/api/types.ts'
import MarketIndexTicker from '../src/components/MarketIndexTicker/index.tsx'
import { INDEX_FRAME_MS, INDEX_SWITCH_MS, INDEX_TRANSITION_MS } from '../src/components/MarketIndexTicker/lib.ts'
import { quote } from './helpers/fixtures.ts'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame, waitForInput } from './helpers/ink.tsx'

const COLUMNS = 40
const ROWS = 3

/** 一次过渡的帧数: 打字机每帧写出行宽的 1/FRAME_TICKS */
const FRAME_TICKS = INDEX_TRANSITION_MS / INDEX_FRAME_MS

const SHANGHAI = quote({
  code: 'sh000001',
  name: '上证指数',
  current: 3245.67,
  change: 12.34,
  changePercent: 0.38,
})

const SHENZHEN = quote({
  code: 'sz399001',
  name: '深证成指',
  current: 12424.66,
  change: -196.24,
  changePercent: -1.55,
})

const renderTicker = (indices: Quote[]) => {
  const output = new CaptureOutput(COLUMNS, ROWS)
  const instance = renderInk(
    createElement(Box, { width: COLUMNS, height: ROWS }, createElement(MarketIndexTicker, { indices })),
    { output },
  )
  return { output, instance }
}

/**
 * 推进假时钟直到某一帧满足条件. 帧定时器挂在 effect 上, 而 ink 在 commit 阶段就把帧写出来了,
 * 两者没有先后保证, 因此不能"推进一次就断言某一帧": 每轮先让出一拍真实时间等 effect 落定,
 * 再推进一帧. 多推进也安全: 帧数在实现里被钳在 FRAME_TICKS.
 */
const advanceUntilFrame = async (
  output: CaptureOutput,
  from: number,
  predicate: (text: string) => boolean,
): Promise<string> => {
  for (let attempt = 0; attempt <= FRAME_TICKS + 1; attempt += 1) {
    await waitForInput()
    const frame = output.frames.slice(from).findLast((candidate) => predicate(plain(candidate)))
    if (frame !== undefined) return plain(frame)
    vi.advanceTimersByTime(INDEX_FRAME_MS)
  }

  throw new Error('打字机没有写出预期的帧')
}

// 只假 interval: Ink 的渲染调度和 waitForFrame 的轮询都靠真实 setTimeout, 一起假掉会等不到帧
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
})

afterEach(() => {
  vi.useRealTimers()
})

test('index ticker 首帧整行显示第一个指数, 不播动画', async () => {
  const { output, instance } = renderTicker([SHANGHAI, SHENZHEN])

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('上证指数'))
    expect(plain(frame)).toContain('上证指数 3245.67 +12.34 +0.38%')
    expect(plain(frame)).not.toContain('深证成指')
  } finally {
    await unmountApp(instance)
  }
})

test('index ticker 每 5 秒换一个指数, 1 秒内从左往右把新行写出来', async () => {
  const { output, instance } = renderTicker([SHANGHAI, SHENZHEN])

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes('上证指数'))

    // 切换定时器同样挂在 effect 上: 推进假时钟之前先让出一拍, 否则它可能还没挂上
    await waitForInput()
    const afterSwitch = output.frames.length
    vi.advanceTimersByTime(INDEX_SWITCH_MS)
    // 到点先清空整行, 再从左边写
    await waitForFrame(output, afterSwitch, (candidate) => !plain(candidate).includes('上证指数'))

    // 写了一半: 名称已经写完, 数值段还没写完 (具体写到第几列由帧数决定, 因此只断言"还没写完")
    const half = await advanceUntilFrame(
      output,
      afterSwitch,
      (text) => text.includes('深证成指') && !text.includes('-1.55%'),
    )
    expect(half).toContain('深证成指')

    // 走满 1 秒: 整行写完
    const full = await advanceUntilFrame(output, afterSwitch, (text) => text.includes('-1.55%'))
    expect(full).toContain('深证成指 12424.66 -196.24 -1.55%')
  } finally {
    await unmountApp(instance)
  }
})

test('index ticker 只有一个指数时不轮播', async () => {
  const { output, instance } = renderTicker([SHANGHAI])

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes('上证指数'))

    vi.advanceTimersByTime(20_000)
    await delay(50)
    // 没有第二个可换: 也没有清空重写的过渡帧
    expect(plain(output.frames.at(-1) ?? '')).toContain('上证指数 3245.67 +12.34 +0.38%')
  } finally {
    await unmountApp(instance)
  }
})

test('index ticker 在行情到达前不渲染任何东西', async () => {
  const { output, instance } = renderTicker([])

  try {
    // 组件返回 null: 整块只有底色空格
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes('\n'))
    expect(plain(output.frames.at(-1) ?? '').trim()).toBe('')
  } finally {
    await unmountApp(instance)
  }
})
