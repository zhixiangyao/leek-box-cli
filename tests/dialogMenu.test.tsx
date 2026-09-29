import { expect, test } from 'vitest'

import { MENU_ITEMS } from '../src/navigation/menu.ts'
import { useDialogMenuStore } from '../src/stores/useDialogMenuStore.ts'
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  isDimmed,
  renderApp,
  resetStores,
  selectedCodeIn,
  stubBoardRows,
} from './helpers/app.tsx'
import { missingRow } from './helpers/fixtures.ts'
import { CaptureOutput, createInput, plain, waitForFrame, waitForState } from './helpers/ink.tsx'

test('App 的 vim 键: 菜单打开时 j/k 只移动菜单高亮, 看板选中行不动', async () => {
  const output = new CaptureOutput(BOARD_COLUMNS, BOARD_ROWS)
  const input = createInput()

  resetStores()
  stubBoardRows([missingRow('sh600000'), missingRow('sz000001')])

  const instance = renderApp(output, input)

  try {
    const after = output.frames.length
    input.write('\x1B')
    // 菜单打开后底层命令变暗: 不能匹配 '菜单', 状态栏的看板 hint 里也有这两个字
    const menuFrame = await waitForFrame(output, after, (candidate) => isDimmed(candidate))
    expect(plain(menuFrame)).toContain('选择(↑/↓/j/k)')

    input.write('j')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS[1]!.type)
    input.write('k')
    await waitForState(() => useDialogMenuStore.getState().highlightedType === MENU_ITEMS[0]!.type)
    // 菜单开着时看板仍是反显那一行, 选中行没被 j/k 带走
    const afterMenuKeys = await waitForFrame(output, after, (candidate) => isDimmed(candidate))
    expect(selectedCodeIn(afterMenuKeys)).toBe('sh600000')
  } finally {
    instance.unmount()
    await instance.waitUntilExit()
    instance.cleanup()
    resetStores()
  }
})
