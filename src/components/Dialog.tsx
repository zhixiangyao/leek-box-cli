import { Box, type BoxProps, useWindowSize } from 'ink'
import type { ReactNode } from 'react'

type Props = {
  width: number
  height: number
  children: ReactNode
} & BoxProps

/**
 * 浮层弹窗公共外壳: 绝对定位 + useWindowSize 居中 + classic 边框 + 不透明黑底.
 * MenuDialog / StockDetailDialog 复用; 不透明背景遮住底下经 useOverlayOpen 变暗的页面,
 * 内容不会从弹窗 padding 区域透出.
 */
export default function Dialog({ width, height, children, ...boxProps }: Props) {
  const { rows, columns } = useWindowSize()
  const top = Math.max(0, Math.floor((rows - height) / 2))
  const left = Math.max(0, Math.floor((columns - width) / 2))

  return (
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
      {...boxProps}
    >
      {children}
    </Box>
  )
}
