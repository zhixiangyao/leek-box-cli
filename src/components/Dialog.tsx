import { Box, useWindowSize } from 'ink'
import type { ReactNode } from 'react'

import BorderTitle from './BorderTitle.tsx'
import StatusBar from './StatusBar.tsx'

type Props = {
  title?: ReactNode
  width: number
  children: ReactNode
}

export default function Dialog(props: Props) {
  const { title, width, children } = props
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
      <Box flexDirection="column" width={width} borderStyle="round">
        {title ? <BorderTitle title={title} bright top={-1} left={1} /> : null}

        <Box flexDirection="column" paddingX={1} paddingY={1} backgroundColor="black">
          {children}
        </Box>

        <StatusBar bright />
      </Box>
    </Box>
  )
}
