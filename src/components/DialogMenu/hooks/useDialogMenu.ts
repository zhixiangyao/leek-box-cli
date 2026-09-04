import { useApp, useInput } from 'ink'

import { SCREEN_REGISTRY_ENTRIES, type Screen } from '../../../cli/registry.ts'
import { useDialogMenuStore } from '../../../stores/useDialogMenuStore.ts'
import { useRouterStore } from '../../../stores/useRouterStore.ts'

type MenuItem = { type: Screen | 'exit'; label: string }

const MENU_ITEMS: MenuItem[] = [
  ...SCREEN_REGISTRY_ENTRIES.map<MenuItem>(([screen, definition]) => ({
    type: screen,
    label: definition.menuLabel,
  })),
  { type: 'exit', label: '退出程序' },
]

export function useDialogMenu() {
  const goTo = useRouterStore((state) => state.goTo)
  const close = useDialogMenuStore((state) => state.close)
  const highlight = useDialogMenuStore((state) => state.highlight)
  const setHighlight = useDialogMenuStore((state) => state.setHighlight)
  const { exit } = useApp()

  function choose(item: MenuItem) {
    switch (item.type) {
      case 'exit': {
        exit()
        break
      }

      default: {
        close()
        goTo(item.type)
        break
      }
    }
  }

  useInput((input, key) => {
    if (key.escape) close()
    else if (key.upArrow) {
      setHighlight((highlight + MENU_ITEMS.length - 1) % MENU_ITEMS.length)
    } else if (key.downArrow) {
      setHighlight((highlight + 1) % MENU_ITEMS.length)
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
    menuItems: MENU_ITEMS,
    highlight,
  }
}
