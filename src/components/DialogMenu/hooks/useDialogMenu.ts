import { useApp, useInput } from 'ink'
import { useState } from 'react'

import { SCREEN_REGISTRY, type Screen } from '../../../lib/registry.ts'
import { useDialogMenuStore } from '../../../stores/useDialogMenuStore.ts'
import { useRouterStore } from '../../../stores/useRouterStore.ts'

type MenuItem = { label: string; screen: Screen | undefined }

const MENU_ITEMS: MenuItem[] = [
  ...Object.entries(SCREEN_REGISTRY).map(([screen, definition], index): MenuItem => ({
    label: `${index + 1}) ${definition.menuLabel}`,
    screen: screen as Screen,
  })),
  { label: `${Object.keys(SCREEN_REGISTRY).length + 1}) 退出程序`, screen: undefined },
]

const MENU_WIDTH = 45

export function useDialogMenu() {
  const goTo = useRouterStore((state) => state.goTo)
  const closeMenu = useDialogMenuStore((state) => state.close)
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

  return {
    width: MENU_WIDTH,
    menuItems: MENU_ITEMS,
    highlight,
  }
}
