import { useInput } from 'ink'

import { useTranslation } from '../../../hooks/useTranslation.ts'
import { parseYesNo } from '../../../lib/yesNo.ts'
import { useDialogRemoveConfirmStore } from '../../../stores/useDialogRemoveConfirmStore.ts'

export function useDialogRemoveConfirm() {
  const { t } = useTranslation()
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
      title = t('dialogRemoveConfirm.titleFailed')
      break

    case 'done':
      title = t('dialogRemoveConfirm.titleDone')
      break

    case 'removing':
      title = t('dialogRemoveConfirm.titleRemoving', { count: targets.length })
      break

    case 'confirm':
      title = t('dialogRemoveConfirm.titleConfirm', { count: targets.length })
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
