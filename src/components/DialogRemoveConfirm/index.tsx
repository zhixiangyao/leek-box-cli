import { useWindowSize } from 'ink'
import stringWidth from 'string-width'

import { useTheme } from '../../hooks/useTheme.ts'
import { useTranslation } from '../../hooks/useTranslation.ts'
import Dialog, { DIALOG_CHROME, DIALOG_WIDTH_RESERVE } from '../Dialog.tsx'
import Text from '../Text.tsx'
import { useDialogRemoveConfirm } from './hooks/useDialogRemoveConfirm.ts'

/** 条目列表计入弹窗宽度的上限, 避免超长内容撑宽弹窗 */
const CONTENT_WIDTH_CAP = 60

export default function DialogRemoveConfirm() {
  const theme = useTheme()
  const { t } = useTranslation()
  const { columns } = useWindowSize()
  const { isConfirm, isError, isDone, title, content } = useDialogRemoveConfirm()
  const hint = isConfirm
    ? t('dialogRemoveConfirm.confirmHint')
    : isError || isDone
      ? t('dialogRemoveConfirm.finalHint')
      : undefined
  const widest = Math.max(
    stringWidth(title ?? ''),
    Math.min(stringWidth(content), CONTENT_WIDTH_CAP),
    stringWidth(hint ?? ''),
    24,
  )
  const width = Math.min(Math.max(columns - 2, 1), widest + DIALOG_CHROME + DIALOG_WIDTH_RESERVE)

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
