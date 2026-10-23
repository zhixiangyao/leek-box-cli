import { expect, test } from 'vitest'

import { DIALOG_CHROME, DIALOG_WIDTH_RESERVE, dialogContentWidth, dialogWidth } from '../src/components/Dialog.tsx'

test('dialogContentWidth 取最宽的一项并套内容上限', () => {
  expect(dialogContentWidth(10, 30)).toBe(30)
  expect(dialogContentWidth(10, 100)).toBe(60)
  expect(dialogContentWidth()).toBe(0)
})

test('dialogWidth 取各部分最大值, 含下限, 上限为终端宽度减 2', () => {
  const padding = DIALOG_CHROME + DIALOG_WIDTH_RESERVE

  expect(dialogWidth(100, 30)).toBe(30 + padding)
  // 内容过窄时按 24 列下限
  expect(dialogWidth(100, 10)).toBe(24 + padding)
  // 终端放不下时被宽度上限压住
  expect(dialogWidth(20, 100)).toBe(18)
  expect(dialogWidth(1, 100)).toBe(1)
})
