import { create } from 'zustand'

import type { Screen } from '../lib/screens.ts'

type RouterState = {
  screen: Screen
  menuOpen: boolean
  toggleMenu: () => void
  goTo: (screen: Screen) => void
}

/**
 * 页面路由 store: 启动直接进 dashboard (cli.tsx 在 render 前 setState 覆盖初始页),
 * 菜单是 esc 调起的浮层弹窗, 选择菜单项后切页并关闭弹窗; 菜单打开/关闭与当前页相互独立.
 */
export const useRouterStore = create<RouterState>()((set) => ({
  screen: 'dashboard',
  menuOpen: false,
  toggleMenu: () => set((state) => ({ menuOpen: !state.menuOpen })),
  goTo: (screen) => set({ screen, menuOpen: false }),
}))
