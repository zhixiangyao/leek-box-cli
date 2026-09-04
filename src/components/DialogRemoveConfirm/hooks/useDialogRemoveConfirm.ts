import { useInput } from 'ink'

import { parseYesNo } from '../../../lib/yesNo.ts'
import { useDialogRemoveConfirmStore } from '../../../stores/useDialogRemoveConfirmStore.ts'

export function useDialogRemoveConfirm() {
  const step = useDialogRemoveConfirmStore((state) => state.step)
  const targets = useDialogRemoveConfirmStore((state) => state.targets)
  const confirmDelete = useDialogRemoveConfirmStore((state) => state.confirmDelete)
  const close = useDialogRemoveConfirmStore((state) => state.close)
  const isConfirm = step.type === 'confirm'
  const isError = step.type === 'error'
  const isDone = step.type === 'done'
  const content = isError || isDone ? step.message : targets.map((entry) => `${entry.name} (${entry.code})`).join(', ')
  let title: string | undefined

  switch (step.type) {
    case 'error':
      title = '删除失败'
      break

    case 'done':
      title = '删除完成'
      break

    case 'removing':
      title = `正在删除 ${targets.length} 个股票...`
      break

    case 'confirm':
      title = `确定删除选中的 ${targets.length} 个股票?`
      break
  }

  useInput(
    (input, key) => {
      if (key.ctrl) return

      switch (step.type) {
        case 'confirm': {
          const inputYesOrNo = parseYesNo(input)
          if (inputYesOrNo === 'y') void confirmDelete()
          else if (inputYesOrNo === 'n') close()
          break
        }

        case 'done':
        case 'error': {
          if (key.escape) close()
          break
        }
      }
    },
    { isActive: ['confirm', 'done', 'error'].includes(step.type) },
  )

  return {
    isConfirm,
    isError,
    isDone,
    title,
    content,
  }
}
