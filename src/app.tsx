import { Box, useApp, useInput, useWindowSize } from 'ink'
import type { ComponentType } from 'react'

import BorderTitle from './components/BorderTitle.tsx'
import BorderUpdatedAt from './components/BorderUpdatedAt.tsx'
import MenuDialog from './components/MenuDialog.tsx'
import StatusBar from './components/StatusBar.tsx'
import StockDetailDialog from './components/StockDetailDialog/index.tsx'
import Text from './components/Text.tsx'
import WindowSizeGuard from './components/WindowSizeGuard.tsx'
import { useOverlayOpen } from './hooks/useOverlayOpen.ts'
import { SCREEN_META, type Screen } from './lib/screens.ts'
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
    } else if (input === 'q' && !overlayOpen) {
      exit()
    }
  })

  const Component = screenComponentMap.get(routerStore.screen)

  return (
    <WindowSizeGuard>
      <Box flexDirection="column" height={rows} width={columns} borderStyle="round" borderDimColor={overlayOpen}>
        <Box flexGrow={1} flexDirection="column" alignItems="flex-start" padding={1}>
          {Component && <Component />}
        </Box>

        <StatusBar hint={SCREEN_META[routerStore.screen].hint} />
      </Box>

      {menuStore.open && <MenuDialog />}
      {stockDetailStore.code && <StockDetailDialog />}

      <BorderTitle title={<Text color="magenta">{SCREEN_META[routerStore.screen].title}</Text>} top={0} left={2} />
      <BorderUpdatedAt />
    </WindowSizeGuard>
  )
}
