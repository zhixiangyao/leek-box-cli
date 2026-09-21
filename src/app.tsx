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
import { useTranslation } from './hooks/useTranslation.ts'
import { COMMAND_REGISTRY, type Command, type CommandComponentProps } from './navigation/registry.ts'
import { useDialogMenuStore } from './stores/useDialogMenuStore.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

const COMMAND_COMPONENTS: Record<Command, ComponentType<CommandComponentProps>> = {
  'stock-list': StockList,
  'stock-add': StockAdd,
  'stock-remove': StockRemove,
  settings: Settings,
}

export default function App() {
  const { exit } = useApp()
  const { t } = useTranslation()
  const overlayOpen = useOverlayOpen()
  const command = useRouterStore((state) => state.command)
  const open = useDialogMenuStore((state) => state.open)
  const { title, hint } = COMMAND_REGISTRY[command]
  const CommandComponent = COMMAND_COMPONENTS[command]

  useInput(
    (input, key) => {
      if (key.escape) open(command)
      if (input === 'q') exit()
    },
    { isActive: !overlayOpen.open },
  )

  return (
    <WindowSizeGuard>
      <CommandComponent title={t(title)} hint={t(hint)} />

      {overlayOpen.dialogMenuOpen && <DialogMenu />}
      {overlayOpen.dialogStockDetailOpen && <DialogStockDetail />}
      {overlayOpen.dialogRemoveConfirmOpen && <DialogRemoveConfirm />}
      {overlayOpen.dialogConfirmOpen && <DialogConfirm />}
    </WindowSizeGuard>
  )
}
