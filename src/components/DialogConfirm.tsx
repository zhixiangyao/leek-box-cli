import { useInput, useWindowSize } from 'ink'
import stringWidth from 'string-width'

import { useTheme } from '../hooks/useTheme.ts'
import { parseYesNo } from '../lib/yesNo.ts'
import { useDialogConfirmStore } from '../stores/useDialogConfirmStore.ts'
import Dialog, { DIALOG_CHROME, DIALOG_WIDTH_RESERVE } from './Dialog.tsx'
import Text from './Text.tsx'

/** 确认阶段的提示 */
const HINT = '取消(n)   确定(y)'

/** 失败阶段的提示 */
const CLOSE_HINT = '关闭(esc)   重试(y)'

/** 内容计入弹窗宽度的上限, 避免超长内容撑宽弹窗 */
const CONTENT_WIDTH_CAP = 60

export default function DialogConfirm() {
  const theme = useTheme()
  const { columns } = useWindowSize()
  const config = useDialogConfirmStore((state) => state.config)
  const close = useDialogConfirmStore((state) => state.close)
  const title = config?.title
  const content = config?.content
  const isError = config?.isError ?? false
  const confirm = config?.confirm
  const hint = isError ? CLOSE_HINT : HINT
  const widest = Math.max(
    stringWidth(title ?? ''),
    Math.min(stringWidth(content ?? ''), CONTENT_WIDTH_CAP),
    stringWidth(hint),
    24,
  )
  const width = Math.min(Math.max(columns - 2, 1), widest + DIALOG_CHROME + DIALOG_WIDTH_RESERVE)

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (key.escape && isError) close()
      // 失败保留弹窗: 错误已由确认方更新到 config, 无需再次处理
      else if (parseYesNo(input) === 'y') confirm?.().then(close, () => undefined)
      else if (parseYesNo(input) === 'n' && !isError) close()
    },
    { isActive: !!config },
  )

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
      <Text color={isError ? 'red' : undefined}>{content}</Text>
    </Dialog>
  )
}
