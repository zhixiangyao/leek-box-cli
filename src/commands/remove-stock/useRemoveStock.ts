import { useEffect, useState } from 'react'

import { useValidatedInput } from '../../hooks/useValidatedInput.ts'
import { useYnConfirm } from '../../hooks/useYnConfirm.ts'
import { errorMessage } from '../../lib/error.ts'
import { loadWatchlist, removeStock, type WatchEntry } from '../../lib/watchlist.ts'

export type Step =
  | { type: 'loading' }
  | { type: 'select'; entries: WatchEntry[] }
  | { type: 'confirm'; entry: WatchEntry }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string }

/** 删除自选股: 加载列表 -> 编号选择 -> y/n 确认 -> 写入 */
export function useRemoveStock() {
  const [step, setStep] = useState<Step>({ type: 'loading' })
  const indexInput = useValidatedInput()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const entries = await loadWatchlist()
        if (cancelled) return
        if (entries.length === 0) {
          setStep({ type: 'error', message: '自选股为空, 请先添加股票.' })
        } else {
          setStep({ type: 'select', entries })
        }
      } catch (err) {
        if (cancelled) return
        setStep({ type: 'error', message: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleChoice = (choice: string) => {
    const current = step as { type: 'select'; entries: WatchEntry[] }
    const index = Number(choice.trim())
    if (!Number.isInteger(index) || index < 1 || index > current.entries.length) {
      indexInput.reject(`无效的序号, 请输入 1-${current.entries.length}`)
      return
    }
    indexInput.accept()
    setStep({ type: 'confirm', entry: current.entries[index - 1]! })
  }

  const confirm = useYnConfirm({
    onConfirm: async () => {
      const current = step as { type: 'confirm'; entry: WatchEntry }
      try {
        await removeStock(current.entry.code)
        setStep({ type: 'done', message: `已删除 ${current.entry.name} (${current.entry.code}).` })
      } catch (err) {
        setStep({ type: 'error', message: `删除失败: ${errorMessage(err)}` })
      }
    },
    onCancel: () => setStep({ type: 'done', message: '已取消.' }),
  })

  return {
    step,
    indexInputError: indexInput.inputError,
    indexInputKey: indexInput.inputKey,
    confirmInputError: confirm.inputError,
    confirmInputKey: confirm.inputKey,
    handleChoice,
    handleConfirm: confirm.handleAnswer,
  }
}
