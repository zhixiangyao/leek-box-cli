import { useApp, useInput } from 'ink'

import { type Item, ITEMS } from '../../../cli/menu.ts'
import { useTranslation } from '../../../hooks/useTranslation.ts'
import { errorMessage } from '../../../lib/error.ts'
import { settingsPath } from '../../../settings/file.ts'
import { resetAll } from '../../../settings/resetAll.ts'
import { useDialogConfirmStore } from '../../../stores/useDialogConfirmStore.ts'
import { useDialogMenuStore } from '../../../stores/useDialogMenuStore.ts'
import { useRouterStore } from '../../../stores/useRouterStore.ts'

export function useDialogMenu() {
  const { t } = useTranslation()
  const goTo = useRouterStore((state) => state.goTo)
  const currentType = useDialogMenuStore((state) => state.currentType)
  const close = useDialogMenuStore((state) => state.close)
  const setCurrentType = useDialogMenuStore((state) => state.setCurrentType)
  const config = useDialogConfirmStore((state) => state.config)
  const open = useDialogConfirmStore((state) => state.open)
  const update = useDialogConfirmStore((state) => state.update)
  const { exit } = useApp()
  const bright = !config

  function choose(item: Item) {
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
      if (key.escape) close()
      else if (/^[1-9]$/.test(input)) {
        const index = Number(input) - 1
        const item = ITEMS[index]
        if (!item) return
        setCurrentType(item.type)
        choose(item)
      } else {
        const currentItemIndex = ITEMS.findIndex((item) => item.type === currentType)
        const isFirstItem = currentItemIndex === 0
        const isLastItem = currentItemIndex === ITEMS.length - 1
        if (key.return) {
          const item = ITEMS[currentItemIndex]
          if (item) choose(item)
        } else if (key.upArrow) {
          const item = ITEMS.at(isFirstItem ? ITEMS.length - 1 : currentItemIndex - 1)
          if (item) setCurrentType(item.type)
        } else if (key.downArrow) {
          const item = ITEMS.at(isLastItem ? 0 : currentItemIndex + 1)
          if (item) setCurrentType(item.type)
        }
      }
    },
    {
      isActive: bright,
    },
  )

  return {
    bright,
    currentType,
  }
}
