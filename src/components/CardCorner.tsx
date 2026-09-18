import { Box, type BoxProps } from 'ink'
import type { ReactNode } from 'react'

import Text from './Text.tsx'

type Props = {
  /** 默认为 false */
  bright?: boolean
  children: ReactNode
} & Pick<BoxProps, 'top' | 'right' | 'bottom' | 'left'>

export default function CardCorner(props: Props) {
  const { top, right, bottom, left } = props
  const { bright = false, children } = props

  return (
    <Box top={top} right={right} bottom={bottom} left={left} position="absolute" height={1} overflow="hidden">
      <Text bright={bright}>|</Text>
      {children}
      <Text bright={bright}>|</Text>
    </Box>
  )
}
