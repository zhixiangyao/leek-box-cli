import { Box, type BoxProps } from 'ink'
import type { ReactNode } from 'react'

import Text from './Text.tsx'

type Props = {
  /** 默认为 false */
  bright?: boolean
  title: ReactNode
  top: BoxProps['top']
  left?: BoxProps['left']
  right?: BoxProps['right']
}

export default function BorderTitle({ title, bright = false, top, left, right }: Props) {
  return (
    <Box position="absolute" top={top} left={left} right={right}>
      <Text bright={bright}>|</Text>
      {title}
      <Text bright={bright}>|</Text>
    </Box>
  )
}
