import { useEffect, useState } from 'react'

import { useDialogRemoveConfirmStore } from '../../../stores/useDialogRemoveConfirmStore.ts'
import { useStockRemoveStore, type StockRemoveEntry } from '../../../stores/useStockRemoveStore.ts'

export function useStockRemove() {
  const entries = useStockRemoveStore((state) => state.entries)
  const errorMessage = useStockRemoveStore((state) => state.errorMessage)
  const resetToken = useStockRemoveStore((state) => state.resetToken)
  const loadEntries = useStockRemoveStore((state) => state.loadEntries)
  const removeByCodes = useStockRemoveStore((state) => state.removeByCodes)
  const open = useDialogRemoveConfirmStore((state) => state.open)
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  function onCursorChange(cursor: number) {
    setCursor(cursor)
  }

  function openRemoveConfirm(submitted: StockRemoveEntry[]) {
    open(submitted, removeByCodes)
  }

  return { entries, errorMessage, resetToken, cursor, onCursorChange, openRemoveConfirm }
}
