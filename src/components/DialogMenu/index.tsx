import { useWindowSize } from 'ink'
import stringWidth from 'string-width'

import { useTheme } from '../../hooks/useTheme.ts'
import Dialog, { DIALOG_CHROME } from '../Dialog.tsx'
import Text from '../Text.tsx'
import { useDialogMenu } from './hooks/useDialogMenu.ts'

/** 提示 */
const HINT = '关闭(esc)   选择(↑/↓)   确认(enter)'

/** 选项列表计入弹窗宽度的上限, 避免超长内容撑宽弹窗 */
const CONTENT_WIDTH_CAP = 60

/** 弹窗宽度冗余(自定义调整, 比如觉得默认的宽度太小了, 或者 title + extra 太紧凑了) */
const DIALOG_WIDTH_RESERVE = 6

export default function DialogMenu() {
  const { highlight, menuItems } = useDialogMenu()
  const theme = useTheme()
  const { columns } = useWindowSize()
  const title = '菜单'
  const hint = HINT
  const widest = Math.max(
    stringWidth(title),
    Math.min(...menuItems.map((item, index) => stringWidth(`  ${index + 1}) ${item.label}`)), CONTENT_WIDTH_CAP),
    stringWidth(hint),
    24,
  )
  const width = Math.min(Math.max(columns - 2, 1), widest + DIALOG_CHROME + DIALOG_WIDTH_RESERVE)

  return (
    <Dialog
      title={
        <Text bright color={theme.primary}>
          {title}
        </Text>
      }
      width={width}
      hint={hint}
    >
      {menuItems.map((item, index) => (
        <Text
          bright
          key={item.label}
          color={index === highlight ? 'black' : undefined}
          backgroundColor={index === highlight ? theme.highlight : undefined}
        >
          {`${index === highlight ? '> ' : '  '} ${index + 1}) ${item.label}`}
        </Text>
      ))}
    </Dialog>
  )
}
