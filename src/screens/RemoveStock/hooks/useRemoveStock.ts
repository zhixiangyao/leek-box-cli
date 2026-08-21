import { useEffect } from 'react'

import { useRemoveStockStore } from '../../../stores/useRemoveStockStore.ts'

export function useRemoveStock() {
  const step = useRemoveStockStore((state) => state.step)
  const indexInput = useRemoveStockStore((state) => state.indexInput)
  const confirmInput = useRemoveStockStore((state) => state.confirmInput)
  const handleChoice = useRemoveStockStore((state) => state.handleChoice)
  const handleConfirm = useRemoveStockStore((state) => state.handleConfirm)
  const loadEntries = useRemoveStockStore((state) => state.loadEntries)

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  return {
    step,
    indexInput,
    confirmInput,
    handleChoice,
    handleConfirm,
  }
}
