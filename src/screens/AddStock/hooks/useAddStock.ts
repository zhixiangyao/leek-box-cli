import { useEffect } from 'react'

import { useAddStockStore } from '../../../stores/useAddStockStore.ts'

/** store 常驻, 每次进入页面重置流程 */
export function useAddStockPage() {
  const addStockStore = useAddStockStore()
  const { reset } = addStockStore

  useEffect(() => {
    reset()
  }, [reset])
}
