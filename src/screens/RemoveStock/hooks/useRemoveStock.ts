import { useEffect } from 'react'

import { useRemoveStockStore } from '../../../stores/useRemoveStockStore.ts'

/** store 常驻, 每次进入页面重新加载列表并复位输入状态. */
export function useRemoveStockPage() {
  const loadEntries = useRemoveStockStore((state) => state.loadEntries)

  useEffect(() => {
    loadEntries()
  }, [loadEntries])
}
