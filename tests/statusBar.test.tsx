import type { ReactElement } from 'react'
import { expect, test } from 'vitest'

import StatusBar from '../src/components/StatusBar.tsx'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'
import { resetStores } from './helpers/app.tsx'
import { clockIn } from './helpers/clock.ts'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

const renderStatusBar = (element: ReactElement) => {
  const output = new CaptureOutput(60, 5)
  const instance = renderInk(element, { output })
  return { output, instance }
}

test('StatusBar 只在 showClock 时显示时钟', async () => {
  resetStores()
  const withoutClock = renderStatusBar(<StatusBar hint="操作提示" />)

  try {
    const frame = await waitForFrame(withoutClock.output, 0, (candidate) => plain(candidate).includes('操作提示'))
    expect(clockIn(frame)).toBeUndefined()
  } finally {
    await unmountApp(withoutClock.instance)
  }

  const withClock = renderStatusBar(<StatusBar hint="操作提示" showClock />)
  try {
    const frame = await waitForFrame(withClock.output, 0, (candidate) => clockIn(candidate) !== undefined)
    expect(plain(frame)).toContain('操作提示')
  } finally {
    await unmountApp(withClock.instance)
    resetStores()
  }
})

test('StatusBar bright 使用主题 accent 背景', async () => {
  resetStores()
  useSettingsStore.setState({ themePreset: 'classic' })

  const normal = renderStatusBar(<StatusBar hint="h" />)
  try {
    const frame = await waitForFrame(normal.output, 0, (candidate) => plain(candidate).includes('h'))
    // classic 非 bright 用 gray 背景
    expect(frame).toContain('\u001B[100m')
  } finally {
    await unmountApp(normal.instance)
  }

  const bright = renderStatusBar(<StatusBar hint="h" bright />)
  try {
    const frame = await waitForFrame(bright.output, 0, (candidate) => plain(candidate).includes('h'))
    // classic accent 是 blue
    expect(frame).toContain('\u001B[44m')
  } finally {
    await unmountApp(bright.instance)
    resetStores()
  }
})

test('StatusBar 内时钟每秒刷新', async () => {
  resetStores()
  const { output, instance } = renderStatusBar(<StatusBar showClock />)

  try {
    const first = await waitForFrame(output, 0, (candidate) => clockIn(candidate) !== undefined)
    const firstClock = clockIn(first)
    const after = output.frames.length
    const changed = await waitForFrame(output, after, (candidate) => {
      const clock = clockIn(candidate)
      return clock !== undefined && clock !== firstClock
    })
    expect(clockIn(changed)).not.toBe(firstClock)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
