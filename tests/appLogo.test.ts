import stringWidth from 'string-width'
import { expect, test } from 'vitest'

import { LOGO_LINES } from '../src/components/AppLogo.tsx'
import { MIN_TERMINAL_COLUMNS } from '../src/components/WindowSizeGuard.tsx'

/**
 * art 是手写 ASCII, 居中靠父级 alignItems: 某行多一列就会错位半个差值, 且不会有任何报错.
 * 宽度上限与终端宽度下限绑定: 卡着下限的终端上, 超宽 art 会被裁掉.
 */
test('Logo art 各行等宽且不超过终端宽度下限', () => {
  const widths = LOGO_LINES.map((line) => stringWidth(line))
  expect(new Set(widths).size).toBe(1)
  expect(Math.max(...widths)).toBeLessThanOrEqual(MIN_TERMINAL_COLUMNS)
})
