import { useDialogMenuStore } from '../stores/useDialogMenuStore.ts'
import { useDialogRemoveConfirmStore } from '../stores/useDialogRemoveConfirmStore.ts'
import { useDialogStockDetailStore } from '../stores/useDialogStockDetailStore.ts'

export function useOverlayOpen() {
  const dialogMenuOpen = useDialogMenuStore((state) => state.open)
  const dialogStockDetailOpen = useDialogStockDetailStore((state) => state.stock !== undefined)
  const dialogRemoveConfirmOpen = useDialogRemoveConfirmStore((state) => state.step.type !== 'idle')
  const open = dialogMenuOpen || dialogStockDetailOpen || dialogRemoveConfirmOpen

  return {
    open,
    dialogMenuOpen,
    dialogStockDetailOpen,
    dialogRemoveConfirmOpen,
  }
}
