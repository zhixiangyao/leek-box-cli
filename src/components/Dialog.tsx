import { Box, useWindowSize } from 'ink'
import type { ReactNode } from 'react'

import Card, { type CardProps } from './Card.tsx'
import StatusBar from './StatusBar.tsx'

/** 弹窗宽度冗余默认值 */
export const DIALOG_WIDTH_RESERVE = 6

/** 弹窗 chrome 宽: 边框 2 + paddingX 2 */
export const DIALOG_CHROME = 4

/** 内容计入弹窗宽度的上限, 避免超长内容撑宽弹窗 */
const DIALOG_CONTENT_WIDTH_CAP = 60

/** 弹窗内容宽度下限 */
const DIALOG_MIN_CONTENT_WIDTH = 24

/** 内容宽度: 先取最宽的一项, 再套上限; 列表须逐项传入, 不要先拼成一整串 */
export const dialogContentWidth = (...widths: number[]): number =>
  Math.min(Math.max(0, ...widths), DIALOG_CONTENT_WIDTH_CAP)

/** 弹窗宽度: 各部分取最大值 (含下限), 再加 chrome 与预留, 上限为终端宽度减 2 */
export const dialogWidth = (columns: number, widest: number): number =>
  Math.min(Math.max(columns - 2, 1), Math.max(widest, DIALOG_MIN_CONTENT_WIDTH) + DIALOG_CHROME + DIALOG_WIDTH_RESERVE)

type Props = {
  /** 默认为 true */
  bright?: boolean
  hint?: string
  above?: ReactNode
} & Pick<
  CardProps,
  'borderTopLeft' | 'borderTopRight' | 'borderBottomLeft' | 'borderBottomRight' | 'width' | 'children'
>

export default function Dialog(props: Props) {
  const { bright = true, hint, above } = props
  const { borderTopLeft, borderTopRight, borderBottomLeft, borderBottomRight, width, children } = props
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
      {above && <Box marginBottom={1}>{above}</Box>}
      <Card
        mask
        bright={bright}
        borderTopLeft={borderTopLeft}
        borderTopRight={borderTopRight}
        borderBottomLeft={borderBottomLeft}
        borderBottomRight={borderBottomRight}
        width={width}
        footer={<StatusBar hint={hint} bright={bright} />}
      >
        {children}
      </Card>
    </Box>
  )
}
