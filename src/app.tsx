import { useApp, useInput } from 'ink'
import type { ComponentType } from 'react'

import DialogConfirm from './components/DialogConfirm.tsx'
import DialogMenu from './components/DialogMenu/index.tsx'
import DialogRemoveConfirm from './components/DialogRemoveConfirm/index.tsx'
import DialogStockDetail from './components/DialogStockDetail/index.tsx'
import WindowSizeGuard from './components/WindowSizeGuard.tsx'
import { useOverlayOpen } from './hooks/useOverlayOpen.ts'
import { useTranslation } from './hooks/useTranslation.ts'
import { SCREEN_REGISTRY, type Screen, type ScreenComponentProps } from './navigation/registry.ts'
import Settings from './screens/Settings/index.tsx'
import StockAdd from './screens/StockAdd/index.tsx'
import StockList from './screens/StockList/index.tsx'
import StockRemove from './screens/StockRemove/index.tsx'
import { useDialogMenuStore } from './stores/useDialogMenuStore.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

const SCREEN_COMPONENTS: Record<Screen, ComponentType<ScreenComponentProps>> = {
  'stock-list': StockList,
  'stock-add': StockAdd,
  'stock-remove': StockRemove,
  settings: Settings,
}

export default function App() {
  const { exit } = useApp()
  const { t } = useTranslation()
  const overlayOpen = useOverlayOpen()
  const screen = useRouterStore((state) => state.screen)
  const open = useDialogMenuStore((state) => state.open)
  const { title, hint } = SCREEN_REGISTRY[screen]
  const ScreenComponent = SCREEN_COMPONENTS[screen]

  useInput(
    (input, key) => {
      if (key.escape) open(screen)
      if (input === 'q') exit()
    },
    { isActive: !overlayOpen.open },
  )

  return (
    <WindowSizeGuard>
      <ScreenComponent title={t(title)} hint={t(hint)} />

      {overlayOpen.dialogMenuOpen && <DialogMenu />}
      {overlayOpen.dialogStockDetailOpen && <DialogStockDetail />}
      {overlayOpen.dialogRemoveConfirmOpen && <DialogRemoveConfirm />}
      {overlayOpen.dialogConfirmOpen && <DialogConfirm />}
    </WindowSizeGuard>
  )
}
