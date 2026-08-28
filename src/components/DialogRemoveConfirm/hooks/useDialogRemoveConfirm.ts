import { useInput } from 'ink'

import {
  isRemoveConfirmStep,
  isRemoveOverlayStep,
  useDialogRemoveConfirmStore,
} from '../../../stores/useDialogRemoveConfirmStore.ts'

export function useDialogRemoveConfirm() {
  const step = useDialogRemoveConfirmStore((state) => state.step)
  const targets = useDialogRemoveConfirmStore((state) => state.targets)

  useInput(
    (input, key) => {
      if (key.ctrl) return
      const store = useDialogRemoveConfirmStore.getState()
      if (input === 'y' || input === 'Y') void store.confirmDelete()
      else if (input === 'n' || input === 'N') store.cancel()
    },
    // esc 优先级保证菜单与删除弹窗不会同时出现, 无需再判断菜单状态
    { isActive: isRemoveConfirmStep(step) },
  )

  if (!isRemoveOverlayStep(step)) return undefined

  return {
    stage: step.type,
    entries: targets,
    message: step.type === 'done' || step.type === 'error' ? step.message : undefined,
  }
}
