import { useApp, useInput } from 'ink'

import { SCREEN_REGISTRY } from './cli/registry.ts'
import DialogConfirm from './components/DialogConfirm.tsx'
import DialogMenu from './components/DialogMenu/index.tsx'
import DialogRemoveConfirm from './components/DialogRemoveConfirm/index.tsx'
import DialogStockDetail from './components/DialogStockDetail/index.tsx'
import WindowSizeGuard from './components/WindowSizeGuard.tsx'
import { useOverlayOpen } from './hooks/useOverlayOpen.ts'
import { useTranslation } from './hooks/useTranslation.ts'
import { useDialogMenuStore } from './stores/useDialogMenuStore.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

const noop = () => {}

export default function App() {
  const { exit } = useApp()
  const { t } = useTranslation()
  const overlayOpen = useOverlayOpen()
  const screen = useRouterStore((state) => state.screen)
  const open = useDialogMenuStore((state) => (state.open ? noop : state.toggle))
  const setCurrentType = useDialogMenuStore((state) => state.setCurrentType)
  const ScreenDefinition = SCREEN_REGISTRY[screen]

  useInput(
    (input, key) => {
      if (key.escape) {
        open()
        setCurrentType(screen)
      }
      if (input === 'q') exit()
    },
    { isActive: !overlayOpen.open },
  )

  return (
    <WindowSizeGuard>
      <ScreenDefinition.Component title={t(ScreenDefinition.title)} hint={t(ScreenDefinition.hint)} />

      {overlayOpen.dialogMenuOpen && <DialogMenu />}
      {overlayOpen.dialogStockDetailOpen && <DialogStockDetail />}
      {overlayOpen.dialogRemoveConfirmOpen && <DialogRemoveConfirm />}
      {overlayOpen.dialogConfirmOpen && <DialogConfirm />}
    </WindowSizeGuard>
  )
}
