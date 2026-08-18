import { Box, useApp, useInput, useWindowSize } from 'ink'
import type { ComponentType } from 'react'

import BorderTitle from './components/BorderTitle.tsx'
import BorderUpdatedAt from './components/BorderUpdatedAt.tsx'
import MenuDialog from './components/MenuDialog.tsx'
import StatusBar from './components/StatusBar.tsx'
import StockDetailDialog from './components/StockDetailDialog.tsx'
import WindowSizeGuard from './components/WindowSizeGuard.tsx'
import { useOverlayOpen } from './hooks/useOverlayOpen.ts'
import type { Screen } from './lib/screens.ts'
import AddStock from './screens/AddStock/index.tsx'
import Dashboard from './screens/Dashboard/index.tsx'
import RemoveStock from './screens/RemoveStock/index.tsx'
import { useMenuStore } from './stores/useMenuStore.ts'
import { useRouterStore } from './stores/useRouterStore.ts'
import { useStockDetailStore } from './stores/useStockDetailStore.ts'

const screenComponentMap = new Map<Screen, ComponentType<{}>>([
  ['dashboard', Dashboard],
  ['add-stock', AddStock],
  ['remove-stock', RemoveStock],
])

export default function App() {
  const routerStore = useRouterStore()
  const menuStore = useMenuStore()
  const stockDetailStore = useStockDetailStore()
  const { columns, rows } = useWindowSize()
  const { exit } = useApp()
  const overlayOpen = useOverlayOpen()

  useInput((input, key) => {
    if (key.escape) {
      // esc 优先级: 详情弹窗 > 菜单 (详情开着时先关详情, 不会误开菜单)
      if (stockDetailStore.code) stockDetailStore.close()
      else menuStore.toggle()
    } else if (input === 'q' && !menuStore.open && !stockDetailStore.code) {
      exit()
    }
  })

  const Component = screenComponentMap.get(routerStore.screen)

  return (
    <WindowSizeGuard>
      <Box flexDirection="column" height={rows} width={columns} borderStyle="classic" borderDimColor={overlayOpen}>
        <Box flexGrow={1} flexDirection="column" alignItems="flex-start" padding={1}>
          {Component && <Component />}
        </Box>

        {menuStore.open && <MenuDialog />}
        {stockDetailStore.code && <StockDetailDialog />}

        <StatusBar />
      </Box>

      {/* 边框叠加层必须是带边框 Box 的兄弟节点且排在其后: Ink 按 DOM 顺序绘制, 后画的才覆盖边框字符 */}
      <BorderTitle />
      <BorderUpdatedAt />
    </WindowSizeGuard>
  )
}
