import { Box, type BoxProps } from 'ink'
import type { ReactNode } from 'react'

import Text from './Text.tsx'

type Props = {
  title: ReactNode
  bright?: boolean
  top: BoxProps['top']
  left: BoxProps['left']
}

export default function BorderTitle({ title, bright = false, top, left }: Props) {
  return (
    <Box position="absolute" top={top} left={left}>
      <Text bright={bright}>|</Text>
      {title}
      <Text bright={bright}>|</Text>
    </Box>
  )
}
