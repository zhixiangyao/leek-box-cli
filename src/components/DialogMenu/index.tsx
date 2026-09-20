import { useWindowSize } from 'ink'
import stringWidth from 'string-width'

import { useTheme } from '../../hooks/useTheme.ts'
import { useTranslation } from '../../hooks/useTranslation.ts'
import { MENU_ITEMS } from '../../navigation/menu.ts'
import Dialog, { DIALOG_CHROME, DIALOG_WIDTH_RESERVE } from '../Dialog.tsx'
import Text from '../Text.tsx'
import { useDialogMenu } from './hooks/useDialogMenu.ts'

/** 选项列表计入弹窗宽度的上限, 避免超长内容撑宽弹窗 */
const CONTENT_WIDTH_CAP = 60

export default function DialogMenu() {
  const { bright, highlightedType } = useDialogMenu()
  const theme = useTheme()
  const { t } = useTranslation()
  const { columns } = useWindowSize()
  const title = t('menu.title')
  const hint = t('menu.hint')
  const widest = Math.max(
    stringWidth(title),
    Math.min(
      Math.max(...MENU_ITEMS.map((item, index) => stringWidth(`  ${index + 1}) ${t(item.label)}`))),
      CONTENT_WIDTH_CAP,
    ),
    stringWidth(hint),
    24,
  )
  const width = Math.min(Math.max(columns - 2, 1), widest + DIALOG_CHROME + DIALOG_WIDTH_RESERVE)

  return (
    <Dialog
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
