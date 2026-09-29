import { Box, Text } from 'ink'
import { createElement, type ComponentProps, type ComponentType } from 'react'
import { test } from 'vitest'

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
