import { useApp, useInput } from 'ink'

import { SCREEN_REGISTRY } from './cli/registry.ts'
import DialogMenu from './components/DialogMenu/index.tsx'
import DialogRemoveConfirm from './components/DialogRemoveConfirm/index.tsx'
import DialogStockDetail from './components/DialogStockDetail/index.tsx'
import WindowSizeGuard from './components/WindowSizeGuard.tsx'
import { useOverlayOpen } from './hooks/useOverlayOpen.ts'
import { useDialogMenuStore } from './stores/useDialogMenuStore.ts'
import { useDialogRemoveConfirmStore } from './stores/useDialogRemoveConfirmStore.ts'
import { useDialogStockDetailStore } from './stores/useDialogStockDetailStore.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

export default function App() {
  const { exit } = useApp()
  const { overlayOpen, dialogMenuOpen, dialogStockDetailOpen, dialogRemoveConfirmOpen } = useOverlayOpen()
  const screen = useRouterStore((state) => state.screen)
  const ScreenDefinition = SCREEN_REGISTRY[screen]

  useInput((input, key) => {
    if (key.escape) {
      if (dialogStockDetailOpen) {
        useDialogStockDetailStore.getState().close()
        return
      }

      if (dialogRemoveConfirmOpen) {
        useDialogRemoveConfirmStore.getState().close()
        return
      }

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
