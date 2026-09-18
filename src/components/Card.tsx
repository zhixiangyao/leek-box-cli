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
  topLeft?: ReactNode
  topRight?: ReactNode
  bottomLeft?: ReactNode
  bottomRight?: ReactNode
  footer?: ReactNode
  children: ReactNode
} & Pick<BoxProps, 'width' | 'height'>

export default function Card(props: CardProps) {
  const { bright = false, mask = false } = props
  const { topLeft, topRight, bottomLeft, bottomRight, footer, children } = props
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
      {topLeft && (
        <CardCorner bright={bright} top={-1} left={1}>
          {topLeft}
        </CardCorner>
      )}
      {topRight && (
        <CardCorner bright={bright} top={-1} right={1}>
          {topRight}
        </CardCorner>
      )}
      {bottomLeft && (
        <CardCorner bright={bright} bottom={-1} left={1}>
          {bottomLeft}
        </CardCorner>
      )}
      {bottomRight && (
        <CardCorner bright={bright} bottom={-1} right={1}>
          {bottomRight}
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
