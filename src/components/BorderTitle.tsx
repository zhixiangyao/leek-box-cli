import { Box, Text as InkText, type BoxProps } from 'ink'
import type { ReactNode } from 'react'

import Text from './Text.tsx'

type Props = {
  title: ReactNode
  bright?: boolean
  top: BoxProps['top']
  left: BoxProps['left']
}

/** 边框叠加层必须是带边框 Box 的兄弟节点且排在其后: Ink 按 DOM 顺序绘制, 后画的才覆盖边框字符 */
export default function BorderTitle({ title, bright = false, top, left }: Props) {
  const Bar = bright ? InkText : Text
  return (
    <Box position="absolute" top={top} left={left}>
      <Bar>|</Bar>
      {title}
      <Bar>|</Bar>
    </Box>
  )
}
