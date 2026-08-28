import { useDialogMenuStore } from '../stores/useDialogMenuStore.ts'
import { isRemoveOverlayStep, useDialogRemoveConfirmStore } from '../stores/useDialogRemoveConfirmStore.ts'
import { useDialogStockDetailStore } from '../stores/useDialogStockDetailStore.ts'

export function useOverlayOpen() {
  const dialogMenuOpen = useDialogMenuStore((state) => state.open)
  const dialogStockDetailOpen = useDialogStockDetailStore((state) => state.stock !== undefined)
  const dialogRemoveConfirmOpen = useDialogRemoveConfirmStore((state) => isRemoveOverlayStep(state.step))

  return {
    overlayOpen: dialogMenuOpen || dialogStockDetailOpen || dialogRemoveConfirmOpen,
    dialogMenuOpen,
    dialogStockDetailOpen,
    dialogRemoveConfirmOpen,
  }
}
