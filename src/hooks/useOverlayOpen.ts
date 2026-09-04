import { useDialogConfirmStore } from '../stores/useDialogConfirmStore.ts'
import { useDialogMenuStore } from '../stores/useDialogMenuStore.ts'
import { useDialogRemoveConfirmStore } from '../stores/useDialogRemoveConfirmStore.ts'
import { useDialogStockDetailStore } from '../stores/useDialogStockDetailStore.ts'

export function useOverlayOpen() {
  const dialogConfirmOpen = useDialogConfirmStore((state) => state.config !== undefined)
  const dialogMenuOpen = useDialogMenuStore((state) => state.open)
  const dialogStockDetailOpen = useDialogStockDetailStore((state) => state.stock !== undefined)
  const dialogRemoveConfirmOpen = useDialogRemoveConfirmStore((state) => state.step.type !== 'idle')
  const open = dialogConfirmOpen || dialogMenuOpen || dialogStockDetailOpen || dialogRemoveConfirmOpen

  return {
    open,
    dialogConfirmOpen,
    dialogMenuOpen,
    dialogStockDetailOpen,
    dialogRemoveConfirmOpen,
  }
}
