import { useWindowSize } from 'ink'
import stringWidth from 'string-width'

import { useTheme } from '../../hooks/useTheme.ts'
import { useTranslation } from '../../hooks/useTranslation.ts'
import { MENU_ITEMS } from '../../navigation/menu.ts'
import AppLogo from '../AppLogo.tsx'
import Dialog, { dialogContentWidth, dialogWidth } from '../Dialog.tsx'
import Text from '../Text.tsx'
import { useDialogMenu } from './hooks/useDialogMenu.ts'

export default function DialogMenu() {
  const { bright, highlightedType } = useDialogMenu()
  const theme = useTheme()
  const { t } = useTranslation()
  const { columns } = useWindowSize()
  const title = t('menu.title')
  const hint = t('menu.hint')
  const widest = Math.max(
    stringWidth(title),
    dialogContentWidth(...MENU_ITEMS.map((item, index) => stringWidth(`  ${index + 1}) ${t(item.label)}`))),
    stringWidth(hint),
  )
  const width = dialogWidth(columns, widest)

  return (
    <Dialog
      above={<AppLogo bright={bright} />}
      borderTopLeft={
        <Text bright={bright} color={theme.primary}>
          {title}
        </Text>
      }
      width={width}
      hint={hint}
      bright={bright}
    >
      {MENU_ITEMS.map((item, index) => {
        const selected = item.type === highlightedType
        return (
          <Text
            bright={bright}
            key={item.type}
            color={selected ? 'black' : undefined}
            backgroundColor={selected ? theme.highlight : undefined}
          >
            {`${selected ? '> ' : '  '} ${index + 1}) ${t(item.label)}`}
          </Text>
        )
      })}
    </Dialog>
  )
}
