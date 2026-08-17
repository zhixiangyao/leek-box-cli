import { useState } from 'react'

export type Screen = 'dashboard' | 'add-stock' | 'remove-stock'

/**
 * 页面路由: 启动直接进 dashboard, 菜单是 esc 调起的浮层弹窗,
 * 选择菜单项后切页并关闭弹窗; 菜单打开/关闭与当前页相互独立.
 */
export function useScreenRouter(initialScreen: Screen = 'dashboard') {
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [menuOpen, setMenuOpen] = useState(false)

  const toggleMenu = () => setMenuOpen((open) => !open)

  const goTo = (next: Screen) => {
    setScreen(next)
    setMenuOpen(false)
  }

  return { screen, menuOpen, toggleMenu, goTo }
}
