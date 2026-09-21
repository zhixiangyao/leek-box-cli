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
      <CommandComponent />

      {overlayOpen.dialogMenuOpen && <DialogMenu />}
      {overlayOpen.dialogStockDetailOpen && <DialogStockDetail />}
      {overlayOpen.dialogRemoveConfirmOpen && <DialogRemoveConfirm />}
      {overlayOpen.dialogConfirmOpen && <DialogConfirm />}
    </WindowSizeGuard>
  )
}
