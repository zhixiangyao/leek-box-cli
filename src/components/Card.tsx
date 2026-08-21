import { Box, BoxProps, useWindowSize } from 'ink'
import type { ReactNode } from 'react'

import BorderTitle from './BorderTitle.tsx'

type Props = {
  bright?: boolean
  fullScreen?: boolean
  title?: ReactNode
  extra?: ReactNode
  footer?: ReactNode
  children: ReactNode
} & Pick<BoxProps, 'width' | 'height' | 'backgroundColor'>

export default function Card(props: Props) {
  const { bright = false, fullScreen, title, extra, footer, children } = props
  const { width, height, backgroundColor } = props
  const { columns, rows } = useWindowSize()

  return (
    <Box
      flexDirection="column"
      width={fullScreen ? columns : width}
      height={fullScreen ? rows : height}
      borderStyle="round"
      borderDimColor={bright === false}
    >
      {title ? <BorderTitle title={title} bright={bright} top={-1} left={1} /> : undefined}
      {extra ? <BorderTitle title={extra} bright={bright} top={-1} right={1} /> : undefined}

      <Box flexGrow={1} flexDirection="column" padding={1} backgroundColor={backgroundColor}>
        {children}
      </Box>

      {footer}
    </Box>
  )
}
