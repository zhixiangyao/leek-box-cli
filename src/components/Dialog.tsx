import { Box, useWindowSize } from 'ink'
import type { ReactNode } from 'react'

import BorderTitle from './BorderTitle.tsx'

/** 弹窗 chrome 宽: 边框 2 + paddingX 2, 供调用方推导内容宽度 */
export const DIALOG_CHROME = 4

type Props = {
  title?: ReactNode
  width: number
  children: ReactNode
}

export default function Dialog({ title, width, children }: Props) {
  const { rows, columns } = useWindowSize()

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      width={columns}
      height={rows}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <Box width={width} borderStyle="round">
        {title ? <BorderTitle title={title} bright top={-1} left={1} /> : null}

        <Box flexDirection="column" paddingX={1} paddingY={1} backgroundColor="black">
          {children}
        </Box>
      </Box>
    </Box>
  )
}
