import { Box, type BoxProps, useWindowSize } from 'ink'
import type { ReactNode } from 'react'

import { useTheme } from '../hooks/useTheme.ts'
import { useSettingsStore } from '../stores/useSettingsStore.ts'
import CardCorner from './CardCorner.tsx'
import SpaceMask from './SpaceMask.tsx'

export type CardProps = {
  /** 默认为 false */
  bright?: boolean
  /** 默认为 false */
  mask?: boolean
  fullScreen?: boolean
  borderTopLeft?: ReactNode
  borderTopRight?: ReactNode
  borderBottomLeft?: ReactNode
  borderBottomRight?: ReactNode
  footer?: ReactNode
  children: ReactNode
} & Pick<BoxProps, 'width' | 'height'>

export default function Card(props: CardProps) {
  const { bright = false, mask = false } = props
  const { borderTopLeft, borderTopRight, borderBottomLeft, borderBottomRight, footer, children } = props
  const { fullScreen, width, height } = props
  const theme = useTheme()
  const { columns, rows } = useWindowSize()
  const borderStyle = useSettingsStore((state) => state.borderStyle)

  return (
    <Box
      flexDirection="column"
      width={fullScreen ? columns : width}
      height={fullScreen ? rows : height}
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
        {mask && <SpaceMask bright={bright} width={columns} height={rows} />}

        <Box flexGrow={1} flexDirection="column" padding={1}>
          {children}
        </Box>
      </Box>

      {footer}
    </Box>
  )
}
