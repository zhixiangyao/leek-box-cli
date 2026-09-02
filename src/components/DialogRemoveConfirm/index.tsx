import { useWindowSize } from 'ink'
import stringWidth from 'string-width'

import { useTheme } from '../../hooks/useTheme.ts'
import Dialog, { DIALOG_CHROME } from '../Dialog.tsx'
import Text from '../Text.tsx'
import { useDialogRemoveConfirm } from './hooks/useDialogRemoveConfirm.ts'

/** 确认阶段的提示 */
const HINT = '取消(esc/n)   确定(y)'

/** 失败/完成阶段的提示 */
const CLOSE_HINT = '关闭(esc)'

/** 条目列表计入弹窗宽度的上限, 避免超长内容撑宽弹窗 */
const CONTENT_WIDTH_CAP = 60

export default function DialogRemoveConfirm() {
  const theme = useTheme()
  const { columns } = useWindowSize()
  const { isConfirm, isError, isDone, title, content } = useDialogRemoveConfirm()
  const hint = isConfirm ? HINT : isError || isDone ? CLOSE_HINT : undefined
  const widest = Math.max(
    stringWidth(title ?? ''),
    Math.min(stringWidth(content ?? ''), CONTENT_WIDTH_CAP),
    stringWidth(hint ?? ''),
    24,
  )
  const width = Math.min(Math.max(columns - 2, 1), widest + DIALOG_CHROME + 6)

  return (
    <Dialog
      title={
        <Text bright color={isError ? 'red' : theme.primary}>
          {title}
        </Text>
      }
      hint={hint}
      width={width}
    >
      <Text bright color={isError ? 'red' : isDone ? theme.primary : 'gray'}>
        {content}
      </Text>
    </Dialog>
  )
}
