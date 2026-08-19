import { create } from 'zustand'

import { fetchQuotes, normalizeCode } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'
import { addStock, loadWatchlist } from '../lib/watchlist.ts'
import { parseYn, YN_ERROR_MESSAGE } from '../lib/yn.ts'

export type AddStockStep =
  | { type: 'input-code' }
  | { type: 'checking'; code: string }
  | { type: 'confirm'; code: string; name: string; current: number }
  | { type: 'already-exists'; code: string; name: string }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string }

type AddStockState = {
  step: AddStockStep
  codeInputError: string | null
  codeInputKey: number
  confirmInputError: string | null
  confirmInputKey: number
  /** 进入页面时重置整个流程 (store 常驻, 防残留上次流程) */
  reset: () => void
  /** 输入代码: 规范化 -> 行情验证 -> 确认 */
  handleCodeInput: (input: string) => void
  handleConfirm: (answer: string) => void
}

// 流程代数: reset 或离开页面后, 进行中的异步请求结果会被丢弃, 避免旧响应污染新流程
let flowSeq = 0

export const useAddStockStore = create<AddStockState>()((set, get) => ({
  step: { type: 'input-code' },
  codeInputError: null,
  codeInputKey: 0,
  confirmInputError: null,
  confirmInputKey: 0,

  reset: () => {
    flowSeq += 1
    set({
      step: { type: 'input-code' },
      codeInputError: null,
      codeInputKey: 0,
      confirmInputError: null,
      confirmInputKey: 0,
    })
  },

  handleCodeInput: async (input: string) => {
    const seq = flowSeq
    const code = normalizeCode(input)
    if (!code) {
      set((state) => ({
        codeInputError: '无法识别股票代码, 请输入 6 位数字 (如 600000 或 sh600000).',
        codeInputKey: state.codeInputKey + 1,
      }))
      return
    }
    set((state) => ({ codeInputError: null, codeInputKey: state.codeInputKey + 1 }))
    set({ step: { type: 'checking', code } })

    try {
      const existing = (await loadWatchlist()).find((entry) => entry.code === code)
      if (seq !== flowSeq) return
      if (existing) {
        set({ step: { type: 'already-exists', code, name: existing.name } })
        return
      }
      // fetchQuotes 无匹配时抛错, 能走到这里说明行情一定存在
      const quotes = await fetchQuotes([code])
      if (seq !== flowSeq) return
      const quote = quotes[0]!
      set({ step: { type: 'confirm', code, name: quote.name, current: quote.current } })
    } catch (err) {
      if (seq !== flowSeq) return
      set({ step: { type: 'error', message: errorMessage(err) } })
    }
  },

  handleConfirm: (answer: string) => {
    const yn = parseYn(answer)
    if (!yn) {
      set((state) => ({ confirmInputError: YN_ERROR_MESSAGE, confirmInputKey: state.confirmInputKey + 1 }))
      return
    }
    set((state) => ({ confirmInputError: null, confirmInputKey: state.confirmInputKey + 1 }))
    if (yn === 'n') {
      set({ step: { type: 'done', message: '已取消.' } })
      return
    }

    const seq = flowSeq
    const current = get().step
    if (current.type !== 'confirm') return
    void (async () => {
      try {
        await addStock({ code: current.code, name: current.name, addedAt: new Date().toISOString() })
        if (seq !== flowSeq) return
        set({ step: { type: 'done', message: `已添加 ${current.name} (${current.code}) 到自选股.` } })
      } catch (err) {
        if (seq !== flowSeq) return
        set({ step: { type: 'error', message: `写入自选股失败: ${errorMessage(err)}` } })
      }
    })()
  },
}))
