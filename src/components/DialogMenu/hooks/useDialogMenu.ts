import { useApp, useInput } from 'ink'

import { useTranslation } from '../../../hooks/useTranslation.ts'
import { errorMessage } from '../../../lib/error.ts'
import { keyDirection } from '../../../lib/keys.ts'
import { type MenuItem, MENU_ITEMS } from '../../../navigation/menu.ts'
import { settingsPath } from '../../../settings/file.ts'
import { resetAll } from '../../../settings/resetAll.ts'
import { useDialogConfirmStore } from '../../../stores/useDialogConfirmStore.ts'
import { useDialogMenuStore } from '../../../stores/useDialogMenuStore.ts'
import { useRouterStore } from '../../../stores/useRouterStore.ts'

export function useDialogMenu() {
  const { t } = useTranslation()
  const goTo = useRouterStore((state) => state.goTo)
  const highlightedType = useDialogMenuStore((state) => state.highlightedType)
  const close = useDialogMenuStore((state) => state.close)
  const setHighlightedType = useDialogMenuStore((state) => state.setHighlightedType)
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
        const content = t('menu.resetConfirmContent', { path: settingsPath() })
        open({
          title: t('menu.resetConfirmTitle'),
          content,
          isError: false,
          confirm: async () => {
            update({ content, isError: false })
            try {
              await resetAll()
            } catch (cause) {
              update({ content: t('menu.resetFailed', { error: errorMessage(cause) }), isError: true })
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
      if (highlightedType === undefined) return
      if (key.escape) close()
      else if (/^[1-9]$/.test(input)) {
        const index = Number(input) - 1
        const item = MENU_ITEMS[index]
        if (!item) return
        setHighlightedType(item.type)
        choose(item)
      } else {
        const direction = keyDirection(input, key)
        const currentItemIndex = MENU_ITEMS.findIndex((item) => item.type === highlightedType)
        const isFirstItem = currentItemIndex === 0
        const isLastItem = currentItemIndex === MENU_ITEMS.length - 1
        if (key.return) {
          const item = MENU_ITEMS[currentItemIndex]
          if (item) choose(item)
        } else if (direction === 'up') {
          const item = MENU_ITEMS.at(isFirstItem ? MENU_ITEMS.length - 1 : currentItemIndex - 1)
          if (item) setHighlightedType(item.type)
        } else if (direction === 'down') {
          const item = MENU_ITEMS.at(isLastItem ? 0 : currentItemIndex + 1)
          if (item) setHighlightedType(item.type)
        }
      }
    },
    {
      isActive: bright,
    },
  )

  return {
    bright,
    highlightedType,
  }
}
