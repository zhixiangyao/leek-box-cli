import { Box, useApp, useInput, useWindowSize } from 'ink'
import type { ComponentType } from 'react'

import AddStock from './commands/add-stock/index.tsx'
import Dashboard from './commands/dashboard/index.tsx'
import RemoveStock from './commands/remove-stock/index.tsx'
import BorderTitle from './components/BorderTitle.tsx'
import BorderUpdatedAt from './components/BorderUpdatedAt.tsx'
import MenuDialog from './components/MenuDialog.tsx'
import StatusBar from './components/StatusBar.tsx'
import type { Screen } from './lib/screens.ts'
import { useRouterStore } from './stores/useRouterStore.ts'

const screenComponentMap = new Map<Screen, ComponentType<{}>>([
  ['dashboard', Dashboard],
  ['add-stock', AddStock],
  ['remove-stock', RemoveStock],
])

export default function App() {
  const screen = useRouterStore((state) => state.screen)
  const menuOpen = useRouterStore((state) => state.menuOpen)
  const toggleMenu = useRouterStore((state) => state.toggleMenu)
  const { rows } = useWindowSize()
  const { exit } = useApp()

  useInput((input, key) => {
    if (key.escape) {
      toggleMenu()
    } else if (input === 'q' && !menuOpen) {
      exit()
    }
  })

  const Component = screenComponentMap.get(screen)

  return (
    <Box height={rows} width="100%">
      {/* 菜单打开时 borderDimColor 变暗边框, 背景层文字由本地 Text (src/components/Text.tsx)
          自行订阅 menuOpen 变暗, 形成遮罩效果; MenuDialog 用 ink 的 Text, 保持鲜艳 */}
      <Box flexDirection="column" height={rows} width="100%" borderStyle="classic" borderDimColor={menuOpen}>
        <Box flexGrow={1} flexDirection="column" alignItems="flex-start" padding={1}>
          {Component && <Component />}
        </Box>

        {menuOpen && <MenuDialog />}

        <StatusBar />
      </Box>

      {/* 边框叠加层必须是带边框 Box 的兄弟节点且排在其后: Ink 按 DOM 顺序绘制, 后画的才覆盖边框字符 */}
      <BorderTitle />
      <BorderUpdatedAt />
    </Box>
  )
}
