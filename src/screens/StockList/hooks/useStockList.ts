import { type DOMElement, useBoxMetrics, useInput } from 'ink'
import { useEffect, useRef } from 'react'

import { useOverlayOpen } from '../../../hooks/useOverlayOpen.ts'
import { useStockDetailStore } from '../../../stores/useStockDetailStore.ts'
import {
  DEFAULT_POLL_INTERVAL_MS,
  MAX_POLL_INTERVAL_MS,
  MIN_POLL_INTERVAL_MS,
  POLL_INTERVAL_STEP_MS,
  useStockListStore,
} from '../../../stores/useStockListStore.ts'
import { tableSlices, type TableSliceRange } from '../lib.ts'

const poll = {
  timer: null as ReturnType<typeof setTimeout> | null,
  inFlight: false,
  cancelled: false,
  interval: DEFAULT_POLL_INTERVAL_MS,
}

const pollOnce = async () => {
  if (poll.inFlight) return
  poll.inFlight = true
  try {
    await useStockListStore.getState().refreshQuotes()
  } finally {
    poll.inFlight = false
  }
}

const armNext = () => {
  if (poll.cancelled || poll.timer) return
  poll.timer = setTimeout(() => {
    poll.timer = null
    if (poll.cancelled) return
    void pollOnce().finally(() => {
      if (poll.cancelled) return
      armNext()
    })
  }, poll.interval)
}

const refreshNow = () => void pollOnce()

const adjustPollInterval = (deltaMs: number) => {
  const next = Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, poll.interval + deltaMs))
  if (next === poll.interval) return
  poll.interval = next
  useStockListStore.setState({ pollIntervalMs: next })
  if (poll.timer) clearTimeout(poll.timer)
  poll.timer = null
  armNext()
}

export function useStockListPage() {
  const rowsRef = useRef<DOMElement>(null)
  const boxMetrics = useBoxMetrics(rowsRef)
  const stockListStore = useStockListStore()
  const overlayOpen = useOverlayOpen()
  const visible = boxMetrics.hasMeasured ? Math.max(1, Math.floor(boxMetrics.height)) : 1
  const slices: TableSliceRange =
    stockListStore.step.type === 'table'
      ? tableSlices(
          visible,
          stockListStore.step.quotes.length,
          stockListStore.step.missing.length,
          stockListStore.scrollOffset,
        )
      : { quoteStart: 0, quoteEnd: 0, missingStart: 0, missingEnd: 0 }

  useInput(
    (input, key) => {
      if (key.ctrl) return
      if (key.upArrow) {
        stockListStore.moveSelection(-1, visible)
      } else if (key.downArrow) {
        stockListStore.moveSelection(1, visible)
      } else if (key.return) {
        const { step, selectedIndex } = useStockListStore.getState()
        if (step.type !== 'table') return
        const rowCount = step.quotes.length + step.missing.length
        if (selectedIndex >= rowCount) return
        if (selectedIndex < step.quotes.length) {
          const quote = step.quotes[selectedIndex]!
          useStockDetailStore.getState().open(quote.code, quote.name)
        } else {
          const entry = step.missing[selectedIndex - step.quotes.length]!
          useStockDetailStore.getState().open(entry.code, entry.name)
        }
      } else if (input === 'r') {
        refreshNow()
      } else if (input === '-') {
        adjustPollInterval(-POLL_INTERVAL_STEP_MS)
      } else if (input === '+') {
        adjustPollInterval(POLL_INTERVAL_STEP_MS)
      }
    },
    { isActive: !overlayOpen },
  )

  useEffect(() => {
    poll.cancelled = false
    useStockListStore.setState({ step: { type: 'loading' } })
    void pollOnce()
    armNext()
    return () => {
      poll.cancelled = true
      if (poll.timer) clearTimeout(poll.timer)
      poll.timer = null
    }
  }, [])

  return { slices, rowsRef }
}
