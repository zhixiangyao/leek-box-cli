import { create } from 'zustand'

import { fetchQuotes, normalizeCode, type Quote } from '../api/index.ts'
import { errorMessage } from '../lib/error.ts'
import { parseYesNo, YES_NO_ERROR_MESSAGE } from '../lib/yesNo.ts'
import { stocksAdd } from '../settings/file.ts'
import { type StockEntry } from '../settings/schema.ts'

type StockCandidate = Pick<StockEntry, 'code' | 'name'> & { current: number }

export type StockAddStep =
  | { type: 'input-code' }
  | { type: 'checking'; codes: string[] }
  | { type: 'confirm'; entries: StockCandidate[] }
  | { type: 'saving'; entries: StockCandidate[] }
  | { type: 'already-exists'; entries: StockCandidate[] }
  | { type: 'done'; message: string }
  | { type: 'error'; message: string }

/** 处于代码输入阶段 (等待股票代码输入) */
export const isAddInputStep = (step: StockAddStep): step is Extract<StockAddStep, { type: 'input-code' }> =>
  step.type === 'input-code'

/** 处于确认阶段 (接受 y/n 或回车确认) */
export const isAddConfirmStep = (step: StockAddStep): step is Extract<StockAddStep, { type: 'confirm' }> =>
  step.type === 'confirm'

/** 处于结果展示阶段 (already-exists/done/error, 返回即重置流程) */
export const isAddResultStep = (
  step: StockAddStep,
): step is Extract<StockAddStep, { type: 'already-exists' | 'done' | 'error' }> =>
  ['already-exists', 'done', 'error'].includes(step.type)

/** 输入框状态: 错误信息与重挂载 token */
type InputState = { error: string | undefined; resetToken: number }

type StockAddState = {
  /** 添加流程状态机 (输入 → 校验 → 确认 → 保存 → 结果) */
  step: StockAddStep
  /** 股票代码输入框状态 */
  codeInput: InputState
  /** 确认输入框状态 */
  confirmInput: InputState
  /** 回到代码输入阶段并清空错误 */
  reset: () => void
  /** 校验输入的股票代码并进入确认阶段 */
  handleCodeInput: (input: string) => Promise<void>
  /** 处理 y/n 确认并写入自选股 */
  handleConfirm: (answer: string) => Promise<void>
}

export type StockAddDependencies = {
  /** 批量写入自选股, 返回实际新增数量 */
  stocksAdd: (entries: StockEntry[]) => Promise<number>
  /** 拉取行情, 用于校验代码并获取名称 */
  fetchQuotes: (codes: string[]) => Promise<Quote[]>
  /** 归一化用户输入的股票代码 */
  normalizeCode: (input: string) => string | undefined
  /** 当前时间 (新条目的 addedAt) */
  now: () => string
}

const defaultDependencies: StockAddDependencies = {
  stocksAdd,
  fetchQuotes,
  normalizeCode,
  now: () => new Date().toISOString(),
}

const FRESH_INPUT: InputState = { error: undefined, resetToken: 0 }

const INVALID_CODE_MESSAGE = '无法识别股票代码, 请用英文逗号分隔 6 位股票代码.'

export function createStockAddStore(dependencies: StockAddDependencies = defaultDependencies) {
  let generation = 0
  const isStale = (value: number) => value !== generation

  return create<StockAddState>()((set, get) => {
    /** 代码输入非法: 记录错误并重挂载输入框 */
    const rejectCodeInput = () =>
      set((state) => ({ codeInput: { error: INVALID_CODE_MESSAGE, resetToken: state.codeInput.resetToken + 1 } }))

    return {
      step: { type: 'input-code' },
      codeInput: FRESH_INPUT,
      confirmInput: FRESH_INPUT,

      reset: () => {
        generation += 1
        set({ step: { type: 'input-code' }, codeInput: FRESH_INPUT, confirmInput: FRESH_INPUT })
      },

      handleCodeInput: async (input: string) => {
        if (!isAddInputStep(get().step)) return
        const currentGeneration = generation
        const rawCodes = input.split(',').map((value) => value.trim())
        if (rawCodes.length === 0 || rawCodes.some((value) => value === '')) {
          rejectCodeInput()
          return
        }

        const normalizedCodes = rawCodes.map((value) => dependencies.normalizeCode(value))
        if (normalizedCodes.some((code) => code === undefined)) {
          rejectCodeInput()
          return
        }
        const codes = [...new Set(normalizedCodes)] as string[]

        set((state) => ({ codeInput: { error: undefined, resetToken: state.codeInput.resetToken + 1 } }))
        set({ step: { type: 'checking', codes } })

        try {
          const quotes = await dependencies.fetchQuotes(codes)
          if (isStale(currentGeneration)) return
          const quotesByCode = new Map(quotes.map((quote) => [quote.code, quote]))
          const missingCodes = codes.filter((code) => !quotesByCode.has(code))
          if (missingCodes.length > 0) {
            set({ step: { type: 'error', message: `未找到股票代码: ${missingCodes.join(', ')}.` } })
            return
          }

          const entries = codes.map((code) => {
            const quote = quotesByCode.get(code)!
            return { code, name: quote.name, current: quote.current }
          })
          set({ step: { type: 'confirm', entries } })
        } catch (error) {
          if (!isStale(currentGeneration)) set({ step: { type: 'error', message: errorMessage(error) } })
        }
      },

      handleConfirm: async (answer: string) => {
        const confirmation = parseYesNo(answer)
        if (!confirmation) {
          set((state) => ({
            confirmInput: { error: YES_NO_ERROR_MESSAGE, resetToken: state.confirmInput.resetToken + 1 },
          }))
          return
        }
        set((state) => ({ confirmInput: { error: undefined, resetToken: state.confirmInput.resetToken + 1 } }))
        if (confirmation === 'n') {
          set({ step: { type: 'done', message: '已取消.' } })
          return
        }

        const currentGeneration = generation
        const current = get().step
        if (!isAddConfirmStep(current)) return
        set({ step: { type: 'saving', entries: current.entries } })
        try {
          const addedAt = dependencies.now()
          const addedCount = await dependencies.stocksAdd(
            current.entries.map((entry) => ({
              code: entry.code,
              name: entry.name,
              addedAt,
            })),
          )
          if (isStale(currentGeneration)) return
          if (addedCount === 0) {
            set({ step: { type: 'already-exists', entries: current.entries } })
            return
          }

          const existingCount = current.entries.length - addedCount
          set({
            step: {
              type: 'done',
              message: `已添加 ${addedCount} 个股票, ${existingCount} 个已在自选股中.`,
            },
          })
        } catch (error) {
          if (!isStale(currentGeneration)) {
            set({ step: { type: 'error', message: `写入自选股失败: ${errorMessage(error)}` } })
          }
        }
      },
    }
  })
}

export const useStockAddStore = createStockAddStore()
