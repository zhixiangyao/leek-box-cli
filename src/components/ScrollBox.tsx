import { Box, type DOMElement, useBoxMetrics } from 'ink'
import { type ReactNode, useEffect, useRef } from 'react'

export const DEFAULT_VISIBLE = 1

/** 越界钳制的滚动偏移: 内容整段放得下时不滚, 否则落在 [0, total - visible] */
const clampOffset = (total: number, scrollOffset: number, visible: number) =>
  total <= visible ? 0 : Math.min(Math.max(scrollOffset, 0), total - visible)

export type ScrollBoxProps<T> = {
  list: T[]
  scrollOffset: number
  customRender: (item: T) => ReactNode
  onVisibleChange?: (value: number) => void
}

export default function ScrollBox<T>(props: ScrollBoxProps<T>) {
  const { list, scrollOffset, customRender, onVisibleChange } = props
  const containerRef = useRef<DOMElement>(null)
  const boxMetrics = useBoxMetrics(containerRef)
  const visible = boxMetrics.hasMeasured
    ? Math.max(DEFAULT_VISIBLE, Math.floor(boxMetrics.clientHeight))
    : DEFAULT_VISIBLE
  const offset = clampOffset(list.length, scrollOffset, visible)

  useEffect(() => {
    onVisibleChange?.(visible)
  }, [onVisibleChange, visible])

  return (
    <Box ref={containerRef} flexBasis={0} flexGrow={1} flexDirection="column" overflow="hidden" contentOffsetY={offset}>
      <Box flexDirection="column" flexShrink={0}>
        {list.map(customRender)}
      </Box>
    </Box>
  )
}
