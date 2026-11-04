import { expect, test } from 'vitest'

import Text from '../src/components/Text.tsx'
import { formatClock, useClock } from '../src/hooks/useClock.ts'
import { resetStores } from './helpers/app.tsx'
import { clockIn } from './helpers/clock.ts'
import { CaptureOutput, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

test('formatClock 固定使用上海时区并补齐两位', () => {
  expect(formatClock(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01 08:00:00')
  // UTC 跨年夜在 Shanghai 已经是第二天
  expect(formatClock(new Date('2025-12-31T16:30:45Z'))).toBe('2026-01-01 00:30:45')
  expect(formatClock(new Date('2026-07-01T12:00:00Z'))).toBe('2026-07-01 20:00:00')
})

function ClockProbe() {
  const clock = useClock()
  return <Text>{clock}</Text>
}

test('useClock 返回当前上海时间', async () => {
  resetStores()
  const output = new CaptureOutput(40, 3)
  const instance = renderInk(<ClockProbe />, { output })

  try {
    await waitForFrame(output, 0, (candidate) => clockIn(candidate) !== undefined)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
