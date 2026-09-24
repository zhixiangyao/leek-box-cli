import { useInput } from 'ink'

import { useTranslation } from '../../../hooks/useTranslation.ts'
import { parseYesNo } from '../../../lib/yesNo.ts'
import { useDialogRemoveConfirmStore } from '../../../stores/useDialogRemoveConfirmStore.ts'
import { useStockRemoveStore, type StockRemoveEntry } from '../../../stores/useStockRemoveStore.ts'

const entryLabel = (entry: StockRemoveEntry) =>
  entry.name === undefined ? entry.code : `${entry.name} (${entry.code})`

export function useDialogRemoveConfirm() {
  const { t } = useTranslation()
  const step = useDialogRemoveConfirmStore((state) => state.step)
  const entries = useDialogRemoveConfirmStore((state) => state.entries)
  const confirmDelete = useDialogRemoveConfirmStore((state) => state.confirmDelete)
  const close = useDialogRemoveConfirmStore((state) => state.close)
  const removeByCodes = useStockRemoveStore((state) => state.removeByCodes)
  const isConfirm = step.type === 'confirm'
  const isError = step.type === 'error'
  const isDone = step.type === 'done'
  const content = isError || isDone ? step.message : entries.map(entryLabel).join(', ')
  let title: string | undefined

  switch (step.type) {
    case 'error':
      title = t('dialogRemoveConfirm.titleFailed')
      break

    case 'done':
      title = t('dialogRemoveConfirm.titleDone')
      break

    case 'removing':
      title = t('dialogRemoveConfirm.titleRemoving', { count: entries.length })
      break

    case 'confirm':
      title = t('dialogRemoveConfirm.titleConfirm', { count: entries.length })
      break
  }

  useInput(
    (input, key) => {
      if (key.ctrl) return

      switch (step.type) {
        case 'confirm': {
          const inputYesOrNo = parseYesNo(input)
          if (inputYesOrNo === 'y') void confirmDelete(removeByCodes)
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
