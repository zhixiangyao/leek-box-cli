import { useState } from 'react'

import { useValidatedInput } from '../../hooks/useValidatedInput.ts'
import { useYnConfirm } from '../../hooks/useYnConfirm.ts'
import { errorMessage } from '../../lib/error.ts'
import { fetchQuotes, normalizeCode } from '../../lib/quote.ts'
import { addStock, loadWatchlist } from '../../lib/watchlist.ts'

export type Step =
  | { type: 'input-code' }
  | { type: 'checking'; code: string } // 调用行情接口验证中
  | { type: 'confirm'; code: string; name: string; current: number }
  | { type: 'already-exists'; code: string; name: string }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string }

/** 添加自选股: 输入代码 -> 规范化校验 -> 行情验证 -> y/n 确认 -> 写入 */
export function useAddStock() {
  const [step, setStep] = useState<Step>({ type: 'input-code' })
  const codeInput = useValidatedInput()

  const handleCodeInput = async (input: string) => {
    const code = normalizeCode(input)
    if (!code) {
      codeInput.reject('无法识别股票代码, 请输入 6 位数字 (如 600000 或 sh600000).')
      return
    }
    codeInput.accept()
    setStep({ type: 'checking', code })

    try {
      const existing = (await loadWatchlist()).find((entry) => entry.code === code)
      if (existing) {
        setStep({ type: 'already-exists', code, name: existing.name })
        return
      }
      // fetchQuotes 无匹配时抛错, 能走到这里说明行情一定存在
      const quotes = await fetchQuotes([code])
      const quote = quotes[0]!
      setStep({ type: 'confirm', code, name: quote.name, current: quote.current })
    } catch (err) {
      setStep({ type: 'error', message: errorMessage(err) })
    }
  }

  const confirm = useYnConfirm({
    onConfirm: async () => {
      const current = step as { type: 'confirm'; code: string; name: string }
      try {
        await addStock({ code: current.code, name: current.name, addedAt: new Date().toISOString() })
        setStep({ type: 'done', message: `已添加 ${current.name} (${current.code}) 到自选股.` })
      } catch (err) {
        setStep({ type: 'error', message: `写入自选股失败: ${errorMessage(err)}` })
      }
    },
    onCancel: () => setStep({ type: 'done', message: '已取消.' }),
  })

  return {
    step,
    codeInputError: codeInput.inputError,
    codeInputKey: codeInput.inputKey,
    confirmInputError: confirm.inputError,
    confirmInputKey: confirm.inputKey,
    handleCodeInput,
    handleConfirm: confirm.handleAnswer,
  }
}
