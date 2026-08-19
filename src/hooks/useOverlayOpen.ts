import { useMenuStore } from '../stores/useMenuStore.ts'
import { useStockDetailStore } from '../stores/useStockDetailStore.ts'

/** 任一浮层弹窗 (菜单 / 股票详情) 打开时为 true */
export function useOverlayOpen(): boolean {
  const menuStore = useMenuStore()
  const stockDetailStore = useStockDetailStore()

  return menuStore.open || !!stockDetailStore.code
}
