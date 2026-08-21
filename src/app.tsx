import { useApp, useInput, useWindowSize } from 'ink'

import Card from './components/Card.tsx'
import MenuDialog from './components/MenuDialog/index.tsx'
import StatusBar from './components/StatusBar.tsx'
import StockDetailDialog from './components/StockDetailDialog/index.tsx'
import StockListUpdatedAt from './components/StockListUpdatedAt.tsx'
import Text from './components/Text.tsx'
import WindowSizeGuard from './components/WindowSizeGuard.tsx'
import { useOverlayOpen } from './hooks/useOverlayOpen.ts'
import { SCREEN_REGISTRY } from './lib/registry.ts'
import { useMenuStore } from './stores/useMenuStore.ts'
import { useRouterStore } from './stores/useRouterStore.ts'
import { useStockDetailStore } from './stores/useStockDetailStore.ts'

export default function App() {
  const screen = useRouterStore((state) => state.screen)
  const menuOpen = useMenuStore((state) => state.open)
  const toggleMenu = useMenuStore((state) => state.toggle)
  const detailStock = useStockDetailStore((state) => state.stock)
  const closeDetail = useStockDetailStore((state) => state.close)
  const { columns, rows } = useWindowSize()
  const { exit } = useApp()
  const overlayOpen = useOverlayOpen()
  const screenDefinition = SCREEN_REGISTRY[screen]
  const Component = screenDefinition.component

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
      <Card
        bright={!overlayOpen}
        title={<Text color="magenta">{screenDefinition.title}</Text>}
        extra={screen === 'stock-list' ? <StockListUpdatedAt /> : undefined}
        width={columns}
        height={rows}
        footer={<StatusBar hint={screenDefinition.hint} bright={!overlayOpen} />}
      >
        <Component />
      </Card>

      {menuOpen && <MenuDialog />}
      {detailStock && <StockDetailDialog />}
    </WindowSizeGuard>
  )
}
