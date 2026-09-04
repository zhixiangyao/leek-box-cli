import { useApp, useInput } from 'ink'

import { SCREEN_REGISTRY } from './cli/registry.ts'
import DialogMenu from './components/DialogMenu/index.tsx'
import DialogRemoveConfirm from './components/DialogRemoveConfirm/index.tsx'
import DialogStockDetail from './components/DialogStockDetail/index.tsx'
import WindowSizeGuard from './components/WindowSizeGuard.tsx'
import { useOverlayOpen } from './hooks/useOverlayOpen.ts'
import { useDialogMenuStore } from './stores/useDialogMenuStore.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

const noop = () => {}

export default function App() {
  const { exit } = useApp()
  const overlayOpen = useOverlayOpen()
  const screen = useRouterStore((state) => state.screen)
  const open = useDialogMenuStore((state) => (state.open ? noop : state.toggle))
  const ScreenDefinition = SCREEN_REGISTRY[screen]

  useInput(
    (input, key) => {
      if (key.escape) open()
      if (input === 'q') exit()
    },
    { isActive: !overlayOpen.open },
  )

  return (
    <WindowSizeGuard>
      <ScreenDefinition.Component title={ScreenDefinition.title} hint={ScreenDefinition.hint} />

      {overlayOpen.dialogMenuOpen && <DialogMenu />}
      {overlayOpen.dialogStockDetailOpen && <DialogStockDetail />}
      {overlayOpen.dialogRemoveConfirmOpen && <DialogRemoveConfirm />}
    </WindowSizeGuard>
  )
}
