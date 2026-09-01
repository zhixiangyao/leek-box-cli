import { useApp, useInput } from 'ink'

import { SCREEN_REGISTRY } from './cli/registry.ts'
import DialogMenu from './components/DialogMenu/index.tsx'
import DialogRemoveConfirm from './components/DialogRemoveConfirm/index.tsx'
import DialogStockDetail from './components/DialogStockDetail/index.tsx'
import WindowSizeGuard from './components/WindowSizeGuard.tsx'
import { useOverlayOpen } from './hooks/useOverlayOpen.ts'
import { useDialogMenuStore } from './stores/useDialogMenuStore.ts'
import { isRemoveOverlayStep, useDialogRemoveConfirmStore } from './stores/useDialogRemoveConfirmStore.ts'
import { useDialogStockDetailStore } from './stores/useDialogStockDetailStore.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

export default function App() {
  const { exit } = useApp()
  const { overlayOpen, dialogMenuOpen, dialogStockDetailOpen, dialogRemoveConfirmOpen } = useOverlayOpen()
  const screen = useRouterStore((state) => state.screen)
  const ScreenDefinition = SCREEN_REGISTRY[screen]

  useInput((input, key) => {
    if (key.escape) {
      // esc 优先级: 详情弹窗 > 删除确认弹窗 (confirm 取消, done/error 关闭) > 菜单; 删除进行中忽略
      if (dialogStockDetailOpen) {
        useDialogStockDetailStore.getState().close()
        return
      }
      const removeStep = useDialogRemoveConfirmStore.getState().step
      if (removeStep.type === 'confirm') {
        useDialogRemoveConfirmStore.getState().cancel()
        return
      }
      if (removeStep.type === 'done' || removeStep.type === 'error') {
        useDialogRemoveConfirmStore.getState().dismiss()
        return
      }
      if (isRemoveOverlayStep(removeStep)) return

      useDialogMenuStore.getState().toggle()
      return
    }

    if (input === 'q' && !overlayOpen) exit()
  })

  return (
    <WindowSizeGuard>
      <ScreenDefinition.Component title={ScreenDefinition.title} hint={ScreenDefinition.hint} />

      {dialogMenuOpen && <DialogMenu />}
      {dialogStockDetailOpen && <DialogStockDetail />}
      {dialogRemoveConfirmOpen && <DialogRemoveConfirm />}
    </WindowSizeGuard>
  )
}
