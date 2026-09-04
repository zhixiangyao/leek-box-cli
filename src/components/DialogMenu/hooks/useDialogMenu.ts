import { useApp, useInput } from 'ink'

import { SCREEN_REGISTRY_ENTRIES, type Screen } from '../../../cli/registry.ts'
import { errorMessage } from '../../../lib/error.ts'
import { settingsPath } from '../../../settings/file.ts'
import { resetAll } from '../../../settings/resetAll.ts'
import { useDialogConfirmStore } from '../../../stores/useDialogConfirmStore.ts'
import { useDialogMenuStore } from '../../../stores/useDialogMenuStore.ts'
import { useRouterStore } from '../../../stores/useRouterStore.ts'

type MenuItem = { type: Screen | 'exit' | 'reset'; label: string }

const MENU_ITEMS: MenuItem[] = [
  ...SCREEN_REGISTRY_ENTRIES.map<MenuItem>(([screen, definition]) => ({
    type: screen,
    label: definition.menuLabel,
  })),
  { type: 'reset', label: '重置' },
  { type: 'exit', label: '退出程序' },
]

export function useDialogMenu() {
  const goTo = useRouterStore((state) => state.goTo)
  const highlight = useDialogMenuStore((state) => state.highlight)
  const close = useDialogMenuStore((state) => state.close)
  const setHighlight = useDialogMenuStore((state) => state.setHighlight)
  const config = useDialogConfirmStore((state) => state.config)
  const open = useDialogConfirmStore((state) => state.open)
  const update = useDialogConfirmStore((state) => state.update)
  const { exit } = useApp()
  const bright = !config

  function choose(item: MenuItem) {
    switch (item.type) {
      case 'exit': {
        exit()
        break
      }

      case 'reset': {
        const content = `此操作将重置所有设置与自选股为默认值, 配置文件: ${settingsPath()}`
        open({
          title: '确认重置吗?',
          content,
          isError: false,
          confirm: async () => {
            update({ content, isError: false })
            try {
              await resetAll()
            } catch (cause) {
              update({ content: `重置失败: ${errorMessage(cause)}`, isError: true })
              throw cause
            }
          },
        })
        break
      }

      default: {
        close()
        goTo(item.type)
        break
      }
    }
  }

  useInput(
    (input, key) => {
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
    },
    {
      isActive: bright,
    },
  )

  return {
    bright,
    menuItems: MENU_ITEMS,
    highlight,
  }
}
