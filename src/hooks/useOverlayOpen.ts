import { useMenuStore } from '../stores/useMenuStore.ts'
import { useStockDetailStore } from '../stores/useStockDetailStore.ts'

/** 任一浮层弹窗 (菜单 / 股票详情) 打开时为 true, 只订阅两个 Zustand 布尔派生值. */
export function useOverlayOpen(): boolean {
  const menuOpen = useMenuStore((state) => state.open)
  const detailOpen = useStockDetailStore((state) => state.stock !== null)
  return menuOpen || detailOpen
}
