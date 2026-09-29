import { expect, test } from 'vitest'

import { MIN_TERMINAL_COLUMNS, TABLE_CHROME } from '../src/components/WindowSizeGuard.tsx'
import { LOCALES } from '../src/i18n/locale.ts'
import { stockListColumns, tableWidth } from '../src/lib/quoteTable.ts'

/**
 * 宽度下限必须与界面语言无关: 若按当前 locale 推导, 在恰好满足中文下限的终端上
 * 切到英文就会被守卫拦住, 而设置命令也在守卫之内, 语言再也改不回来.
 */
test('终端宽度下限覆盖全部语言的看板占宽', () => {
  for (const locale of LOCALES) {
    expect(tableWidth(stockListColumns(locale)) + TABLE_CHROME, locale).toBeLessThanOrEqual(MIN_TERMINAL_COLUMNS)
  }
})
