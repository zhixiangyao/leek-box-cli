import { useEffect } from 'react'

import { useStockRemoveStore } from '../../../stores/useStockRemoveStore.ts'

export function useStockRemove() {
  const step = useStockRemoveStore((state) => state.step)
  const indexInput = useStockRemoveStore((state) => state.indexInput)
  const confirmInput = useStockRemoveStore((state) => state.confirmInput)
  const handleChoice = useStockRemoveStore((state) => state.handleChoice)
  const handleConfirm = useStockRemoveStore((state) => state.handleConfirm)
  const loadEntries = useStockRemoveStore((state) => state.loadEntries)

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
