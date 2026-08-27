import { useApp, useInput } from 'ink'

import DialogMenu from './components/DialogMenu/index.tsx'
import DialogStockDetail from './components/DialogStockDetail/index.tsx'
import WindowSizeGuard from './components/WindowSizeGuard.tsx'
import { useOverlayOpen } from './hooks/useOverlayOpen.ts'
import { SCREEN_REGISTRY } from './lib/registry.ts'
import { useMenuStore } from './stores/useMenuStore.ts'
import { useRouterStore } from './stores/useRouterStore.ts'
import { useStockDetailStore } from './stores/useStockDetailStore.ts'

export default function App() {
  const { exit } = useApp()
  const overlayOpen = useOverlayOpen()
  const screen = useRouterStore((state) => state.screen)
  const menuOpen = useMenuStore((state) => state.open)
  const toggleMenu = useMenuStore((state) => state.toggle)
  const detailStock = useStockDetailStore((state) => state.stock)
  const closeDetail = useStockDetailStore((state) => state.close)
  const ScreenDefinition = SCREEN_REGISTRY[screen]

  useInput((input, key) => {
    if (key.escape) {
      // esc 优先级: 详情弹窗 > 菜单 (详情开着时先关详情, 不会误开菜单)
      if (detailStock) closeDetail()
      else toggleMenu()
    } else if (input === 'q' && !overlayOpen) {
      exit()
    }
  })

  return (
    <WindowSizeGuard>
      <ScreenDefinition.Component title={ScreenDefinition.title} hint={ScreenDefinition.hint} />

      {menuOpen && <DialogMenu />}
      {detailStock && <DialogStockDetail />}
    </WindowSizeGuard>
  )
}
