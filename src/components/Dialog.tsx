import { Box, useWindowSize } from 'ink'
import type { ReactNode } from 'react'

import Card from './Card.tsx'
import StatusBar from './StatusBar.tsx'

/** 弹窗 chrome 宽: 边框 2 + paddingX 2 */
export const DIALOG_CHROME = 4

type Props = {
  title?: ReactNode
  extra?: ReactNode
  hint?: string
  width: number
  children: ReactNode
}

export default function Dialog(props: Props) {
  const { title, extra, hint, width, children } = props
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
      <Card
        bright
        title={title}
        extra={extra}
        width={width}
        backgroundColor="black"
        footer={<StatusBar hint={hint} bright />}
      >
        {children}
      </Card>
    </Box>
  )
}
