import { useEffect } from 'react'

import { useAddStockStore } from '../../../stores/useAddStockStore.ts'

export function useAddStock() {
  const step = useAddStockStore((state) => state.step)
  const codeInput = useAddStockStore((state) => state.codeInput)
  const confirmInput = useAddStockStore((state) => state.confirmInput)
  const handleCodeInput = useAddStockStore((state) => state.handleCodeInput)
  const handleConfirm = useAddStockStore((state) => state.handleConfirm)
  const reset = useAddStockStore((state) => state.reset)

  useEffect(() => {
    reset()
  }, [reset])

  return {
    step,
    codeInput,
    confirmInput,
    handleCodeInput,
    handleConfirm,
  }
}
