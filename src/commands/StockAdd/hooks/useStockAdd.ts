import { useEffect } from 'react'

import { useCommandStore } from '../../../stores/useCommandStore.ts'
import { useStockAddStore } from '../../../stores/useStockAddStore.ts'

export function useStockAdd() {
  const step = useStockAddStore((state) => state.step)
  const codeInput = useStockAddStore((state) => state.codeInput)
  const confirmInput = useStockAddStore((state) => state.confirmInput)
  const handleCodeInput = useStockAddStore((state) => state.handleCodeInput)
  const handleConfirm = useStockAddStore((state) => state.handleConfirm)
  const reset = useStockAddStore((state) => state.reset)
  const setCommand = useCommandStore((state) => state.setCommand)

  function handleSubmit() {
    reset()
    setCommand('stock-add')
  }

  useEffect(() => {
    reset()
  }, [reset])

  return {
    step,
    codeInput,
    confirmInput,
    handleCodeInput,
    handleConfirm,
    handleSubmit,
  }
}
