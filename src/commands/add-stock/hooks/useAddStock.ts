import { useEffect } from 'react'

import { useAddStockStore } from '../../../stores/useAddStockStore.ts'

/** store 常驻, 每次进入页面重置流程, 保证与旧版"挂载即新流程"行为一致 */
export function useAddStockPage() {
  const reset = useAddStockStore((state) => state.reset)

  useEffect(() => {
    reset()
  }, [reset])
}
