import { useMenuStore } from '../stores/useMenuStore.ts'
import { useStockDetailStore } from '../stores/useStockDetailStore.ts'

/**
 * 任一浮层弹窗 (菜单 / 股票详情) 打开时为 true.
 * 背景层 (页面文字 / 边框 / StatusBar) 的变暗遮罩统一由它驱动 —
 * 背景层的文字必须走本地 `components/Text.tsx`, 浮层自身用 ink 原版 Text 保持鲜艳.
 * 用 selector 取单个字段: 详情 store 每 30s 轮询更新, 整店订阅会让全部背景文字跟着重渲染.
 */
export function useOverlayOpen(): boolean {
  const menuOpen = useMenuStore((state) => state.open)
  const detailCode = useStockDetailStore((state) => state.code)

  return menuOpen || detailCode !== null
}
