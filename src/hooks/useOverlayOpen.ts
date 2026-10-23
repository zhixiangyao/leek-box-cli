import { useSyncExternalStore } from 'react'

import { useDialogConfirmStore } from '../stores/useDialogConfirmStore.ts'
import { useDialogMenuStore } from '../stores/useDialogMenuStore.ts'
import { useDialogRemoveConfirmStore } from '../stores/useDialogRemoveConfirmStore.ts'
import { useDialogStockDetailStore } from '../stores/useDialogStockDetailStore.ts'

const isDialogConfirmOpen = () => useDialogConfirmStore.getState().config !== undefined
const isDialogMenuOpen = () => useDialogMenuStore.getState().highlightedType !== undefined
const isDialogStockDetailOpen = () => useDialogStockDetailStore.getState().code !== undefined
const isDialogRemoveConfirmOpen = () => useDialogRemoveConfirmStore.getState().step.type !== 'idle'

/** 是否有任意浮层打开 */
const isOverlayOpen = () =>
  isDialogConfirmOpen() || isDialogMenuOpen() || isDialogStockDetailOpen() || isDialogRemoveConfirmOpen()

/** 四个浮层 store 的监听在模块级共享一份, 各组件只往这个 Set 里增减自己的回调 */
const overlayListeners = new Set<() => void>()
let stopWatching: (() => void) | undefined

const notifyOverlayListeners = () => {
  for (const listener of overlayListeners) listener()
}

const startWatching = () => {
  const unsubscribers = [
    useDialogConfirmStore.subscribe(notifyOverlayListeners),
    useDialogMenuStore.subscribe(notifyOverlayListeners),
    useDialogStockDetailStore.subscribe(notifyOverlayListeners),
    useDialogRemoveConfirmStore.subscribe(notifyOverlayListeners),
  ]
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe()
  }
}

const subscribeOverlayOpen = (listener: () => void) => {
  overlayListeners.add(listener)
  stopWatching ??= startWatching()

  return () => {
    overlayListeners.delete(listener)
    if (overlayListeners.size > 0) return
    stopWatching?.()
    stopWatching = undefined
  }
}

/** 只关心是否有浮层 (dim) 的窄订阅; 所有使用者共享一组 store 监听 */
export function useOverlayOpenValue(): boolean {
  return useSyncExternalStore(subscribeOverlayOpen, isOverlayOpen, isOverlayOpen)
}

export function useOverlayOpen() {
  const dialogConfirmOpen = useDialogConfirmStore((state) => state.config !== undefined)
  const dialogMenuOpen = useDialogMenuStore((state) => state.highlightedType !== undefined)
  const dialogStockDetailOpen = useDialogStockDetailStore((state) => state.code !== undefined)
  const dialogRemoveConfirmOpen = useDialogRemoveConfirmStore((state) => state.step.type !== 'idle')
  const open = dialogConfirmOpen || dialogMenuOpen || dialogStockDetailOpen || dialogRemoveConfirmOpen

  return {
    open,
    dialogConfirmOpen,
    dialogMenuOpen,
    dialogStockDetailOpen,
    dialogRemoveConfirmOpen,
  }
}
