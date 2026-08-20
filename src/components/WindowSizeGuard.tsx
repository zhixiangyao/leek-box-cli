import { Box, useWindowSize } from 'ink'
import type { ReactNode } from 'react'

import { MIN_TERMINAL_ROWS } from '../lib/layout.ts'
import { stockTableWidth } from '../lib/stockTable.ts'
import Text from './Text.tsx'

/** 看板表格占宽: 内容 + 边框 2 + padding 2. */
const MIN_COLUMNS = stockTableWidth() + 4

type Props = {
  children: ReactNode
}

export default function WindowSizeGuard({ children }: Props) {
  const { columns, rows } = useWindowSize()
  const widthOk = columns >= MIN_COLUMNS
  const heightOk = rows >= MIN_TERMINAL_ROWS

  if (widthOk && heightOk) return children

  return (
    <Box width={columns} height={rows} flexDirection="column" alignItems="center" justifyContent="center">
      <Text color="yellow">终端尺寸过小:</Text>
      <Box>
        <Text color={widthOk ? 'green' : 'red'}>{`宽度 = ${columns}`}</Text>
        <Text> </Text>
        <Text color={heightOk ? 'green' : 'red'}>{`高度 = ${rows}`}</Text>
      </Box>
      <Box height={1} />
      <Text color="gray">所需最小尺寸:</Text>
      <Text color="gray">{`宽度 = ${MIN_COLUMNS} 高度 = ${MIN_TERMINAL_ROWS}`}</Text>
    </Box>
  )
}
