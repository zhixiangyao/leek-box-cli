import { Box, useApp, useInput, useWindowSize } from 'ink'
import type { ComponentType } from 'react'

import AddStock from './commands/add-stock/index.tsx'
import Dashboard from './commands/dashboard/index.tsx'
import RemoveStock from './commands/remove-stock/index.tsx'
import MenuDialog from './components/MenuDialog.tsx'
import StatusBar from './components/StatusBar.tsx'
import { useRouterStore, type Screen } from './stores/router.ts'

type CommandScreen = Screen

const screenComponentMap = new Map<CommandScreen, ComponentType<{ onBack: () => void; isActive: boolean }>>([
  ['dashboard', Dashboard],
  ['add-stock', AddStock],
  ['remove-stock', RemoveStock],
])

const SCREEN_HINTS: Record<Screen, string> = {
  ['dashboard']: '菜单(esc)   刷新(r)   间隔(-/+)   退出(q)',
  ['add-stock']: '菜单(esc)   退出(q)',
  ['remove-stock']: '菜单(esc)   退出(q)',
}

export default function App() {
  const screen = useRouterStore((state) => state.screen)
  const menuOpen = useRouterStore((state) => state.menuOpen)
  const toggleMenu = useRouterStore((state) => state.toggleMenu)
  const goTo = useRouterStore((state) => state.goTo)
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
  const backToDashboard = () => goTo('dashboard')

  return (
    <Box flexDirection="column" height={rows} width="100%" borderStyle="classic">
      <Box flexGrow={1} flexDirection="column" alignItems="flex-start" padding={1}>
        {Component && <Component isActive={!menuOpen} onBack={backToDashboard} />}
      </Box>

      {menuOpen && <MenuDialog onSelect={goTo} />}

      <StatusBar hint={SCREEN_HINTS[screen]} />
    </Box>
  )
}
