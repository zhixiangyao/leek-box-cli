import { useWindowSize } from 'ink'
import stringWidth from 'string-width'

import { useTheme } from '../../hooks/useTheme.ts'
import { useTranslation } from '../../hooks/useTranslation.ts'
import Dialog, { dialogContentWidth, dialogWidth } from '../Dialog.tsx'
import Text from '../Text.tsx'
import { useDialogRemoveConfirm } from './hooks/useDialogRemoveConfirm.ts'

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
  const widest = Math.max(stringWidth(title ?? ''), dialogContentWidth(stringWidth(content)), stringWidth(hint ?? ''))
  const width = dialogWidth(columns, widest)

  return (
    <Dialog
      borderTopLeft={
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
