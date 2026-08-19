import { Box, useWindowSize } from 'ink'
import type { JSX } from 'react'

import BorderTitle from './BorderTitle.tsx'

type Props = {
  title?: JSX.Element | JSX.Element[]
  width: number
  height: number
  children: JSX.Element | JSX.Element[]
}

export default function Dialog({ title, width, height, children }: Props) {
  const { rows, columns } = useWindowSize()
  const top = Math.max(0, Math.floor((rows - height) / 2))
  const left = Math.max(0, Math.floor((columns - width) / 2))

  return (
    <>
      <Box
        position="absolute"
        top={top}
        left={left}
        width={width}
        height={height}
        borderStyle="classic"
        backgroundColor="black"
        flexDirection="column"
        paddingX={1}
        paddingY={1}
      >
        {children}
      </Box>

      {title ? <BorderTitle title={title} bright top={top} left={left + 2} /> : null}
    </>
  )
}
