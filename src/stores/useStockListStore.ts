import { create } from 'zustand'

import { fetchQuotes } from '../api/index.ts'
import type { Quote } from '../api/types.ts'
import { errorMessage } from '../lib/error.ts'
import { loadStocks } from '../settings/file.ts'

export type StockListRow = { kind: 'quote'; code: string; quote: Quote } | { kind: 'missing'; code: string }

export type StockListStep =
  | { type: 'loading' }
  | { type: 'empty' }
  | { type: 'error'; message: string }
  | { type: 'table'; rows: StockListRow[]; errorLine?: string }

/** 排序模式: default 保持自选股文件顺序, desc/asc 分别按涨跌幅从高到低, 从低到高 */
export type StockListSortMode = 'default' | 'desc' | 'asc'

type StockListState = {
  step: StockListStep
  sortMode: StockListSortMode
  selectedCode: string | undefined
  scrollOffset: number
  refreshQuotes: (signal?: AbortSignal) => Promise<void>
  moveSelection: (delta: 1 | -1, visible: number) => void
  cycleSortMode: () => void
  reset: () => void
}

export type StockListDependencies = {
  fetchQuotes: typeof fetchQuotes
  loadStocks: typeof loadStocks
}

const defaultDependencies: StockListDependencies = { fetchQuotes, loadStocks }

const clampSelection = (index: number, rowCount: number) => Math.min(Math.max(index, 0), rowCount - 1)

const anchoredScrollOffset = (
  delta: 1 | -1,
  selectedIndex: number,
  rowCount: number,
  scrollOffset: number,
  visible: number,
) => {
  const next = clampSelection(selectedIndex + delta, rowCount)
  const maxOffset = Math.max(0, rowCount - visible)
  if (delta === 1 && next >= scrollOffset + visible) return Math.min(next - visible + 1, maxOffset)
  if (delta === -1 && next < scrollOffset) return next
  return Math.min(scrollOffset, maxOffset)
}

const rowIndex = (rows: StockListRow[], code: StockListRow['code'] | undefined) => {
  if (!code) return 0
  const index = rows.findIndex((row) => row.code === code)
  return index < 0 ? 0 : index
}

/** 快捷键循环: 文件顺序 -> 降序 -> 升序 -> 文件顺序 */
const SORT_MODE_CYCLE: Record<StockListSortMode, StockListSortMode> = {
  default: 'desc',
  desc: 'asc',
  asc: 'default',
}

/**
 * 按涨跌幅排序: default 原样返回, 即自选股文件顺序.
 * `step.rows` 始终保存文件顺序 (数据), 排序只是显示顺序 (视图), 所以回到 default 不需要重读文件.
 * 缺失行没有涨跌幅可比, 一律排在末尾并保持它们之间的顺序, 否则会被当成 0 混进涨跌区间.
 * 同涨跌幅的行由 sort 的稳定性保持文件顺序.
 */
export const sortedRows = (rows: StockListRow[], sortMode: StockListSortMode): StockListRow[] => {
  if (sortMode === 'default') return rows
  const quotes = rows.filter((row): row is Extract<StockListRow, { kind: 'quote' }> => row.kind === 'quote')
  const missing = rows.filter((row) => row.kind === 'missing')
  const direction = sortMode === 'desc' ? -1 : 1
  quotes.sort((left, right) => direction * (left.quote.changePercent - right.quote.changePercent))
  return [...quotes, ...missing]
}

/**
 * 从 step 取显示顺序的行情行, 非 table 时没有行.
 * "选中和滚动都按显示顺序算"这条不变量只经由这里落地: 各处自己解 step 再排序, 漏一处就会出现
 * 按文件顺序移动选中行这类错误, 而那种错误在渲染上看不出来 (行序由 hook 派生, 仍然是对的).
 */
export const displayedRows = (step: StockListStep, sortMode: StockListSortMode): StockListRow[] =>
  step.type === 'table' ? sortedRows(step.rows, sortMode) : []

/**
 * 显示顺序变了 (排序或刷新) 之后的滚动偏移: 让选中行停在窗口里的同一行.
 * 传入选中行在旧/新顺序里的下标, 否则换一次顺序视图就跳一下.
 */
const scrollOffsetAfterReorder = (previousIndex: number, nextIndex: number, scrollOffset: number) =>
  Math.max(0, nextIndex - Math.max(0, previousIndex - scrollOffset))

const quotesEqual = (left: Quote, right: Quote) =>
  left.code === right.code &&
  left.name === right.name &&
  left.current === right.current &&
  left.prevClose === right.prevClose &&
  left.open === right.open &&
  left.high === right.high &&
  left.low === right.low &&
  left.change === right.change &&
  left.changePercent === right.changePercent &&
  left.timestamp === right.timestamp &&
  left.volume === right.volume &&
  left.turnover === right.turnover &&
  left.turnoverRate === right.turnoverRate &&
  left.amplitude === right.amplitude &&
  left.marketCap === right.marketCap &&
  left.volumeRatio === right.volumeRatio

export function createStockListStore(dependencies: StockListDependencies = defaultDependencies) {
  return create<StockListState>()((set, get) => ({
    step: { type: 'loading' },
    sortMode: 'default',
    selectedCode: undefined,
    scrollOffset: 0,
    refreshQuotes: async (signal?: AbortSignal) => {
      try {
        const entries = await dependencies.loadStocks()
        if (signal?.aborted) return
        if (entries.length === 0) {
          set({ step: { type: 'empty' }, selectedCode: undefined, scrollOffset: 0 })
          return
        }
        const fetchedQuotes = await dependencies.fetchQuotes(
          entries.map((entry) => entry.code),
          signal,
        )
        if (signal?.aborted) return

        set((state) => {
          const previousRows = state.step.type === 'table' ? state.step.rows : []
          // 选中行和滚动偏移都按显示顺序算, 而 step.rows 是文件顺序, 因此比较基准要先取显示顺序
          const previousDisplayed = displayedRows(state.step, state.sortMode)
          const previousQuotes = new Map(
            previousRows
              .filter((row): row is Extract<StockListRow, { kind: 'quote' }> => row.kind === 'quote')
              .map((row) => [row.code, row.quote]),
          )
          const quoteByCode = new Map(
            fetchedQuotes.map((quote) => {
              const previous = previousQuotes.get(quote.code)
              return [quote.code, previous && quotesEqual(previous, quote) ? previous : quote]
            }),
          )
          const rows = entries.map<StockListRow>((entry) => {
            const quote = quoteByCode.get(entry.code)
            return quote ? { kind: 'quote', code: entry.code, quote } : { kind: 'missing', code: entry.code }
          })
          const displayed = sortedRows(rows, state.sortMode)
          const previousIndex = rowIndex(previousDisplayed, state.selectedCode)
          const preservedIndex = state.selectedCode ? displayed.findIndex((row) => row.code === state.selectedCode) : -1
          const nextIndex = preservedIndex >= 0 ? preservedIndex : clampSelection(previousIndex, displayed.length)
          const relativeIndex = Math.max(0, previousIndex - state.scrollOffset)
          return {
            step: { type: 'table', rows },
            selectedCode: displayed[nextIndex]?.code,
            scrollOffset: Math.max(0, nextIndex - relativeIndex),
          }
        })
      } catch (error) {
        if (signal?.aborted) return
        const message = errorMessage(error)
        set((state) =>
          state.step.type === 'table'
            ? { step: { ...state.step, errorLine: message } }
            : { step: { type: 'error', message } },
        )
      }
    },
    moveSelection: (delta: 1 | -1, visible: number) => {
      const { step, sortMode, selectedCode, scrollOffset } = get()
      if (step.type !== 'table' || step.rows.length === 0) return
      const displayed = displayedRows(step, sortMode)
      const currentIndex = rowIndex(displayed, selectedCode)
      const nextIndex = clampSelection(currentIndex + delta, displayed.length)
      set({
        selectedCode: displayed[nextIndex]?.code,
        scrollOffset: anchoredScrollOffset(delta, currentIndex, displayed.length, scrollOffset, visible),
      })
    },
    cycleSortMode: () => {
      const { step, sortMode, selectedCode, scrollOffset } = get()
      const nextSortMode = SORT_MODE_CYCLE[sortMode]
      if (step.type !== 'table') {
        set({ sortMode: nextSortMode })
        return
      }

      // 只换显示顺序: 选中行在窗口里的相对位置保持不变 (与刷新时同一规则), 否则排序后它会突然跳出去
      const previousIndex = rowIndex(displayedRows(step, sortMode), selectedCode)
      const nextIndex = rowIndex(displayedRows(step, nextSortMode), selectedCode)
      set({ sortMode: nextSortMode, scrollOffset: scrollOffsetAfterReorder(previousIndex, nextIndex, scrollOffset) })
    },
    reset: () => {
      set({ step: { type: 'loading' }, sortMode: 'default', selectedCode: undefined, scrollOffset: 0 })
    },
  }))
}

export const useStockListStore = createStockListStore()
