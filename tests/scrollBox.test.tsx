import { Box } from 'ink'
import { expect, test } from 'vitest'

import { visibleWindow } from '../src/commands/StockList/lib.ts'
import ScrollBox, { clampOffset, DEFAULT_VISIBLE } from '../src/components/ScrollBox.tsx'
import Text from '../src/components/Text.tsx'
import { resetStores } from './helpers/app.tsx'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

/**
 * ScrollBox 与看板的 visibleWindow 是分层使然的两份钳制实现 (components 不 import commands).
 * 改一处必须同时改另一处, 这里把两边的落点锁在一起.
 */
test('clampOffset 与 visibleWindow 给出相同的窗口起点', () => {
  for (let total = 0; total <= 8; total += 1) {
    for (let offset = -2; offset <= 10; offset += 1) {
      for (let visible = 1; visible <= 5; visible += 1) {
        expect(clampOffset(total, offset, visible), `${total}/${offset}/${visible}`).toBe(
          visibleWindow(total, offset, visible).start,
        )
      }
    }
  }
})

const renderList = (list: string[], scrollOffset: number, height = 2) => {
  const output = new CaptureOutput(20, 10)
  const visibleCalls: number[] = []
  const instance = renderInk(
    <Box height={height} flexDirection="column">
      <ScrollBox
        list={list}
        scrollOffset={scrollOffset}
        customRender={(item) => <Text key={item}>{item}</Text>}
        onVisibleChange={(value) => visibleCalls.push(value)}
      />
    </Box>,
    { output },
  )
  return { output, instance, visibleCalls }
}

test('ScrollBox 按偏移只显示窗口内的行, 并上报可视行数', async () => {
  resetStores()
  const { output, instance, visibleCalls } = renderList(['a', 'b', 'c', 'd'], 1)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => {
      const text = plain(candidate)
      return text.includes('b') && text.includes('c')
    })
    const text = plain(frame)
    expect(text).not.toContain('a')
    expect(text).not.toContain('d')
    // CaptureOutput 不做布局测量, 这里锁的是未测量时的兜底行数; 真实 clientHeight 由 App 冒烟覆盖
    expect(visibleCalls.at(-1)).toBe(DEFAULT_VISIBLE)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('ScrollBox 把越界偏移钳制到最后一行窗口', async () => {
  resetStores()
  const { output, instance } = renderList(['a', 'b', 'c', 'd'], 99)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => {
      const text = plain(candidate)
      return text.includes('c') && text.includes('d')
    })
    const text = plain(frame)
    expect(text).not.toContain('a')
    expect(text).not.toContain('b')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('ScrollBox 内容不超过视口时不滚动', async () => {
  resetStores()
  const { output, instance } = renderList(['a', 'b'], 2)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => {
      const text = plain(candidate)
      return text.includes('a') && text.includes('b')
    })
    expect(plain(frame)).toContain('a')
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
