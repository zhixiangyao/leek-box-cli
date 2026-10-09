import { Box, Text } from 'ink'
import { createElement, type ComponentProps, type ComponentType } from 'react'
import { expect, test } from 'vitest'

import Card from '../src/components/Card.tsx'
import { assertFrameSize } from './helpers/app.tsx'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

const TestCard = Card as ComponentType<Omit<ComponentProps<typeof Card>, 'children'>>

/** full 是 100% x 100%, 必须有一个给定尺寸的祖先 (应用里由 WindowSizeGuard 提供) */
test('Card full 占满给定尺寸的父盒而非显式尺寸', async () => {
  const columns = 41
  const rows = 9
  const output = new CaptureOutput(columns, rows)
  const instance = renderInk(
    createElement(
      Box,
      { width: columns, height: rows },
      createElement(
        TestCard,
        {
          full: true,
          width: 7,
          height: 3,
        },
        createElement(Text, null, 'content'),
      ),
    ),
    { output },
  )

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('content'))
    assertFrameSize(frame, columns, rows)
  } finally {
    await unmountApp(instance)
  }
})

test('Card borderTopCenter 落在上边框行并水平居中', async () => {
  const columns = 41
  const rows = 9
  const output = new CaptureOutput(columns, rows)
  const instance = renderInk(
    createElement(
      Box,
      { width: columns, height: rows },
      createElement(
        TestCard,
        {
          full: true,
          borderTopLeft: createElement(Text, { color: 'green' }, 'TITLE'),
          borderTopCenter: createElement(Text, { color: 'cyan' }, 'CENTER'),
          borderTopRight: createElement(Text, { color: 'yellow' }, 'RIGHT'),
        },
        createElement(Text, null, 'content'),
      ),
    ),
    { output },
  )

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('CENTER'))
    const top = plain(frame).split('\n')[0]!
    // 三段同在上边框那一行
    expect(top).toContain('TITLE')
    expect(top).toContain('CENTER')
    expect(top).toContain('RIGHT')
    // 水平居中: 居中槽位跨内容区宽度, 换算到整张 Card 上仍是正中 (不是"只差一格")
    const start = top.indexOf('CENTER')
    expect(start).toBe(Math.floor((columns - 'CENTER'.length) / 2))
    assertFrameSize(frame, columns, rows)
  } finally {
    await unmountApp(instance)
  }
})

test('Card borderTopCenter 过宽时被四角压住 (四角排在中段之后绘制)', async () => {
  const columns = 41
  const rows = 9
  const output = new CaptureOutput(columns, rows)
  const instance = renderInk(
    createElement(
      Box,
      { width: columns, height: rows },
      createElement(
        TestCard,
        {
          full: true,
          borderTopLeft: createElement(Text, null, 'TITLE'),
          // 远宽于 Card 的中段: 自己裁剪溢出, 被压住的应该是它而不是四角
          borderTopCenter: createElement(Text, null, 'C'.repeat(columns * 2)),
          borderTopRight: createElement(Text, null, 'RIGHT'),
        },
        createElement(Text, null, 'content'),
      ),
    ),
    { output },
  )

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('TITLE'))
    const top = plain(frame).split('\n')[0]!
    expect(top).toContain('TITLE')
    expect(top).toContain('RIGHT')
    expect(top.indexOf('TITLE')).toBeLessThan(top.indexOf('RIGHT'))
    // 过宽的中段不撑破 Card, 也不把四角挤走
    assertFrameSize(frame, columns, rows)
  } finally {
    await unmountApp(instance)
  }
})
