import { Box, useApp, useInput, useWindowSize } from 'ink'
import type { ComponentType } from 'react'

import BorderTitle from './components/BorderTitle.tsx'
import BorderUpdatedAt from './components/BorderUpdatedAt.tsx'
import MenuDialog from './components/MenuDialog.tsx'
import StatusBar from './components/StatusBar.tsx'
import WindowSizeGuard from './components/WindowSizeGuard.tsx'
import type { Screen } from './lib/screens.ts'
import AddStock from './screens/add-stock/index.tsx'
import Dashboard from './screens/dashboard/index.tsx'
import RemoveStock from './screens/remove-stock/index.tsx'
import { useMenuStore } from './stores/useMenuStore.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

const screenComponentMap = new Map<Screen, ComponentType<{}>>([
  ['dashboard', Dashboard],
  ['add-stock', AddStock],
  ['remove-stock', RemoveStock],
])

export default function App() {
  const routerStore = useRouterStore()
  const menuStore = useMenuStore()
  const { columns, rows } = useWindowSize()
  const { exit } = useApp()

  useInput((input, key) => {
    if (key.escape) {
      menuStore.toggle()
    } else if (input === 'q' && !menuStore.open) {
      exit()
    }
  })

  const Component = screenComponentMap.get(routerStore.screen)

  return (
    <WindowSizeGuard>
      <Box flexDirection="column" height={rows} width={columns} borderStyle="classic" borderDimColor={menuStore.open}>
        <Box flexGrow={1} flexDirection="column" alignItems="flex-start" padding={1}>
          {Component && <Component />}
        </Box>

        {menuStore.open && <MenuDialog />}

        <StatusBar />
      </Box>

      {/* 边框叠加层必须是带边框 Box 的兄弟节点且排在其后: Ink 按 DOM 顺序绘制, 后画的才覆盖边框字符 */}
      <BorderTitle />
      <BorderUpdatedAt />
    </WindowSizeGuard>
  )
}
