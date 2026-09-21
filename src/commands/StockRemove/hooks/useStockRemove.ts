import { useEffect } from 'react'

import { useDialogRemoveConfirmStore } from '../../../stores/useDialogRemoveConfirmStore.ts'
import { useStockRemoveStore } from '../../../stores/useStockRemoveStore.ts'

export function useStockRemove() {
  const entries = useStockRemoveStore((state) => state.entries)
  const errorMessage = useStockRemoveStore((state) => state.errorMessage)
  const resetToken = useStockRemoveStore((state) => state.resetToken)
  const loadEntries = useStockRemoveStore((state) => state.loadEntries)
  const open = useDialogRemoveConfirmStore((state) => state.open)

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  return { entries, errorMessage, resetToken, open }
}
