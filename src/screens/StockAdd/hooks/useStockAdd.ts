import { useEffect } from 'react'

import { useStockAddStore } from '../../../stores/useStockAddStore.ts'

export function useStockAdd() {
  const step = useStockAddStore((state) => state.step)
  const codeInput = useStockAddStore((state) => state.codeInput)
  const confirmInput = useStockAddStore((state) => state.confirmInput)
  const handleCodeInput = useStockAddStore((state) => state.handleCodeInput)
  const handleConfirm = useStockAddStore((state) => state.handleConfirm)
  const reset = useStockAddStore((state) => state.reset)

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
