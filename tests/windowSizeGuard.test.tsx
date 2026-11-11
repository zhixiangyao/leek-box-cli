import { expect, test } from 'vitest'

import Text from '../src/components/Text.tsx'
import WindowSizeGuard, {
  MIN_TERMINAL_COLUMNS,
  MIN_TERMINAL_ROWS,
  TABLE_CHROME,
} from '../src/components/WindowSizeGuard.tsx'
import { t } from '../src/i18n/core.ts'
import { LOCALES } from '../src/i18n/locale.ts'
import { stockListColumns, tableWidth } from '../src/lib/quoteTable.ts'
import { resetStores } from './helpers/app.tsx'
import { CaptureOutput, plain, renderInk, unmountApp, waitForFrame } from './helpers/ink.tsx'

/**
 * 宽度下限必须与界面语言无关: 若按当前 locale 推导, 在恰好满足中文下限的终端上
 * 切到英文就会被守卫拦住, 而设置命令也在守卫之内, 语言再也改不回来.
 */
test('终端宽度下限覆盖全部语言的看板占宽', () => {
  for (const locale of LOCALES) {
    expect(tableWidth(stockListColumns(locale)) + TABLE_CHROME, locale).toBeLessThanOrEqual(MIN_TERMINAL_COLUMNS)
  }
})

const renderGuard = (columns: number, rows: number) => {
  const output = new CaptureOutput(columns, rows)
  const instance = renderInk(
    <WindowSizeGuard>
      <Text>board-child</Text>
    </WindowSizeGuard>,
    { output },
  )
  return { output, instance }
}

test('尺寸不足时不渲染子树, 显示实际与所需尺寸', async () => {
  resetStores()
  const { output, instance } = renderGuard(40, 10)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes(t('windowGuard.tooSmall')))
    const text = plain(frame)
    expect(text).not.toContain('board-child')
    expect(text).toContain(t('windowGuard.width', { value: 40 }))
    expect(text).toContain(t('windowGuard.height', { value: 10 }))
    expect(text).toContain(t('windowGuard.required'))
    expect(text).toContain(t('windowGuard.width', { value: MIN_TERMINAL_COLUMNS }))
    expect(text).toContain(t('windowGuard.height', { value: MIN_TERMINAL_ROWS }))
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('只有高度不足时仍拦截子树, 宽度行保持通过状态', async () => {
  resetStores()
  const { output, instance } = renderGuard(MIN_TERMINAL_COLUMNS, MIN_TERMINAL_ROWS - 1)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes(t('windowGuard.tooSmall')))
    const text = plain(frame)
    expect(text).not.toContain('board-child')
    expect(text).toContain(t('windowGuard.width', { value: MIN_TERMINAL_COLUMNS }))
    expect(text).toContain(t('windowGuard.height', { value: MIN_TERMINAL_ROWS - 1 }))
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('只有宽度不足时仍拦截子树, 高度行保持通过状态', async () => {
  resetStores()
  const { output, instance } = renderGuard(40, MIN_TERMINAL_ROWS)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes(t('windowGuard.tooSmall')))
    const text = plain(frame)
    expect(text).not.toContain('board-child')
    expect(text).toContain(t('windowGuard.width', { value: 40 }))
    expect(text).toContain(t('windowGuard.height', { value: MIN_TERMINAL_ROWS }))
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('终端尺寸变化时在拦截与渲染子树之间切换', async () => {
  resetStores()
  const { output, instance } = renderGuard(40, 10)

  try {
    await waitForFrame(output, 0, (candidate) => plain(candidate).includes(t('windowGuard.tooSmall')))

    let after = output.frames.length
    output.resize(MIN_TERMINAL_COLUMNS, MIN_TERMINAL_ROWS)
    await waitForFrame(output, after, (candidate) => plain(candidate).includes('board-child'))

    after = output.frames.length
    output.resize(40, 10)
    await waitForFrame(output, after, (candidate) => plain(candidate).includes(t('windowGuard.tooSmall')))
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})

test('尺寸达标时把子树包进给定尺寸的 Box', async () => {
  resetStores()
  const { output, instance } = renderGuard(MIN_TERMINAL_COLUMNS, MIN_TERMINAL_ROWS)

  try {
    const frame = await waitForFrame(output, 0, (candidate) => plain(candidate).includes('board-child'))
    expect(plain(frame)).not.toContain(t('windowGuard.tooSmall'))
    // 守卫的 Box 撑满终端, 作为 full Card 百分比尺寸的基准
    expect(plain(frame).split('\n')).toHaveLength(MIN_TERMINAL_ROWS)
  } finally {
    await unmountApp(instance)
    resetStores()
  }
})
