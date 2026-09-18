import { Box, useWindowSize } from 'ink'

import Card, { type CardProps } from './Card.tsx'
import StatusBar from './StatusBar.tsx'

/** 弹窗宽度冗余默认值 */
export const DIALOG_WIDTH_RESERVE = 6

/** 弹窗 chrome 宽: 边框 2 + paddingX 2 */
export const DIALOG_CHROME = 4

type Props = {
  /** 默认为 true */
  bright?: boolean
  hint?: string
} & Pick<CardProps, 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'width' | 'children'>

export default function Dialog(props: Props) {
  const { bright = true, hint } = props
  const { topLeft, topRight, bottomLeft, bottomRight, width, children } = props
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
        mask
        bright={bright}
        topLeft={topLeft}
        topRight={topRight}
        bottomLeft={bottomLeft}
        bottomRight={bottomRight}
        width={width}
        footer={<StatusBar hint={hint} bright={bright} />}
      >
        {children}
      </Card>
    </Box>
  )
}
