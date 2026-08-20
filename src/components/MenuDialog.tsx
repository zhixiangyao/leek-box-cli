import { useApp, useInput } from 'ink'
import { useState } from 'react'

import { SCREEN_REGISTRY, type Screen } from '../lib/registry.ts'
import { useMenuStore } from '../stores/useMenuStore.ts'
import { useRouterStore } from '../stores/useRouterStore.ts'
import Dialog from './Dialog.tsx'
import Text from './Text.tsx'

type MenuItem = { label: string; screen: Screen | null }

const MENU_ITEMS: MenuItem[] = [
  ...Object.entries(SCREEN_REGISTRY).map(([screen, definition], index): MenuItem => ({
    label: `${index + 1}) ${definition.menuLabel}`,
    screen: screen as Screen,
  })),
  { label: `${Object.keys(SCREEN_REGISTRY).length + 1}) 退出程序`, screen: null },
]

const MENU_WIDTH = 30

export default function MenuDialog() {
  const goTo = useRouterStore((state) => state.goTo)
  const closeMenu = useMenuStore((state) => state.close)
  const { exit } = useApp()
  const [highlight, setHighlight] = useState(0)

  const choose = (item: MenuItem) => {
    if (item.screen) {
      closeMenu()
      goTo(item.screen)
    } else {
      exit()
    }
  }

  useInput((input, key) => {
    if (key.upArrow) {
      setHighlight((previous) => (previous + MENU_ITEMS.length - 1) % MENU_ITEMS.length)
    } else if (key.downArrow) {
      setHighlight((previous) => (previous + 1) % MENU_ITEMS.length)
    } else if (key.return) {
      choose(MENU_ITEMS[highlight]!)
    } else if (/^[1-9]$/.test(input)) {
      const index = Number(input) - 1
      const item = MENU_ITEMS[index]
      if (!item) return
      setHighlight(index)
      choose(item)
    }
  })

  return (
    <Dialog
      title={
        <Text bright color="magenta">
          菜单
        </Text>
      }
      width={MENU_WIDTH}
    >
      {MENU_ITEMS.map((item, index) => (
        <Text
          bright
          key={item.label}
          color={index === highlight ? 'black' : undefined}
          backgroundColor={index === highlight ? 'cyan' : undefined}
        >
          {index === highlight ? '> ' : '  '}
          {item.label}
        </Text>
      ))}
    </Dialog>
  )
}
