import { useApp, useInput } from 'ink'
import type { ComponentType } from 'react'

import Settings from './commands/Settings/index.tsx'
import StockAdd from './commands/StockAdd/index.tsx'
import StockList from './commands/StockList/index.tsx'
import StockRemove from './commands/StockRemove/index.tsx'
import DialogConfirm from './components/DialogConfirm.tsx'
import DialogMenu from './components/DialogMenu/index.tsx'
import DialogRemoveConfirm from './components/DialogRemoveConfirm/index.tsx'
import DialogStockDetail from './components/DialogStockDetail/index.tsx'
import WindowSizeGuard from './components/WindowSizeGuard.tsx'
import { useOverlayOpen } from './hooks/useOverlayOpen.ts'
import { type Command } from './navigation/registry.ts'
import { useCommandStore } from './stores/useCommandStore.ts'
import { useDialogMenuStore } from './stores/useDialogMenuStore.ts'
import { useInputFocusStore } from './stores/useInputFocusStore.ts'

const COMMAND_COMPONENTS: Record<Command, ComponentType> = {
  'stock-list': StockList,
  'stock-add': StockAdd,
  'stock-remove': StockRemove,
  settings: Settings,
}

export default function App() {
  const { exit } = useApp()
  const overlayOpen = useOverlayOpen()
  const command = useCommandStore((state) => state.command)
  const open = useDialogMenuStore((state) => state.open)
  const inputFocused = useInputFocusStore((state) => state.activeCount > 0)
  const CommandComponent = COMMAND_COMPONENTS[command]

  // 常驻注册而不是 isActive: !overlayOpen.open: 尺寸不足时 WindowSizeGuard 会卸载整棵子树,
  // 浮层 (持有此时唯一活跃的 useInput) 随之消失. 一个活跃的 useInput 都不剩时 ink 会 unref stdin,
  // 事件循环随之空转并触发 beforeExit, 应用在拖动终端尺寸时就退出了.
  useInput((input, key) => {
    // 浮层打开时 App 不处理 esc 和 q.
    if (overlayOpen.open) return
    if (key.escape) open(command)
    // 文本输入聚焦时 q 属于输入框, 不处理 q
    if (input === 'q' && !inputFocused) exit()
  })

  return (
    <WindowSizeGuard>
      <CommandComponent />

      {overlayOpen.dialogMenuOpen && <DialogMenu />}
      {overlayOpen.dialogStockDetailOpen && <DialogStockDetail />}
      {overlayOpen.dialogRemoveConfirmOpen && <DialogRemoveConfirm />}
      {overlayOpen.dialogConfirmOpen && <DialogConfirm />}
    </WindowSizeGuard>
  )
}
