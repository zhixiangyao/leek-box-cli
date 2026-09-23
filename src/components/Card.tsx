import { Box, type BoxProps, type DOMElement, useBoxMetrics } from 'ink'
import { useRef, type ReactNode } from 'react'

import { useTheme } from '../hooks/useTheme.ts'
import { useSettingsStore } from '../stores/useSettingsStore.ts'
import CardCorner from './CardCorner.tsx'
import SpaceMask from './SpaceMask.tsx'

export type CardProps = {
  /** 默认为 false */
  bright?: boolean
  /** 默认为 false */
  mask?: boolean
  full?: boolean
  width?: BoxProps['width']
  height?: BoxProps['height']
  borderTopLeft?: ReactNode
  borderTopRight?: ReactNode
  borderBottomLeft?: ReactNode
  borderBottomRight?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

export default function Card(props: CardProps) {
  const { bright = false, mask = false } = props
  const { borderTopLeft, borderTopRight, borderBottomLeft, borderBottomRight, footer, children } = props
  const { full, width, height } = props
  const theme = useTheme()
  const borderStyle = useSettingsStore((state) => state.borderStyle)
  const containerRef = useRef<DOMElement>(null)
  const boxMetrics = useBoxMetrics(containerRef)

  return (
    <Box
      ref={containerRef}
      flexDirection="column"
      width={full ? '100%' : width}
      height={full ? '100%' : height}
      borderStyle={borderStyle}
      borderColor={theme.primary}
      borderDimColor={bright === false}
    >
      {borderTopLeft && (
        <CardCorner bright={bright} top={-1} left={1}>
          {borderTopLeft}
        </CardCorner>
      )}
      {borderTopRight && (
        <CardCorner bright={bright} top={-1} right={1}>
          {borderTopRight}
        </CardCorner>
      )}
      {borderBottomLeft && (
        <CardCorner bright={bright} bottom={-1} left={1}>
          {borderBottomLeft}
        </CardCorner>
      )}
      {borderBottomRight && (
        <CardCorner bright={bright} bottom={-1} right={1}>
          {borderBottomRight}
        </CardCorner>
      )}

      <Box flexGrow={1} overflow={mask ? 'hidden' : undefined}>
        {mask && boxMetrics.hasMeasured && (
          <SpaceMask bright={bright} width={boxMetrics.width} height={boxMetrics.height} />
        )}

        <Box flexGrow={1} flexDirection="column" padding={1}>
          {children}
        </Box>
      </Box>

      {footer}
    </Box>
  )
}
