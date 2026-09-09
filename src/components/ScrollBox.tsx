import { Box, type DOMElement, useBoxMetrics } from 'ink'
import { type ReactNode, useEffect, useRef } from 'react'

export const DEFAULT_VISIBLE = 1

type Window = { start: number; end: number }

const visibleWindow = (total: number, scrollOffset: number, visible: number): Window => {
  if (total <= visible) return { start: 0, end: total }
  const maxStart = total - visible
  const start = Math.min(Math.max(scrollOffset, 0), maxStart)
  return { start, end: start + visible }
}

type Props<T> = {
  list: T[]
  scrollOffset: number
  customRender: (item: T) => ReactNode
  onWindowChange?: (value: Window) => void
  onVisibleChange?: (value: number) => void
}

export default function ScrollBox<T>(props: Props<T>) {
  const { list, scrollOffset, customRender, onWindowChange, onVisibleChange } = props
  const containerRef = useRef<DOMElement>(null)
  const boxMetrics = useBoxMetrics(containerRef)
  const visible = boxMetrics.hasMeasured ? Math.max(DEFAULT_VISIBLE, Math.floor(boxMetrics.height)) : DEFAULT_VISIBLE
  const window = visibleWindow(list.length, scrollOffset, visible)

  useEffect(() => {
    onWindowChange?.({
      start: window.start,
      end: window.end,
    })
  }, [onWindowChange, window.start, window.end])

  useEffect(() => {
    onVisibleChange?.(visible)
  }, [onVisibleChange, visible])

  return (
    <Box ref={containerRef} flexDirection="column" flexGrow={1} overflow="hidden">
      {list.slice(window.start, window.end).map(customRender)}
    </Box>
  )
}
