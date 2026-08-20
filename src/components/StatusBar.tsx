import { Box } from 'ink'

import { useClock } from '../hooks/useClock.ts'
import { useOverlayOpen } from '../hooks/useOverlayOpen.ts'
import Text from './Text.tsx'

type Props = {
  hint: string
}

export default function StatusBar({ hint }: Props) {
  const overlayOpen = useOverlayOpen()
  const clock = useClock('date-time')

  return (
    <Box
      width="100%"
      justifyContent="space-between"
      paddingX={1}
      // 任一浮层弹窗打开时背景变灰, 配合本地 Text 的 overlayOpen 订阅形成整体遮罩
      backgroundColor={overlayOpen ? 'gray' : 'blue'}
    >
      <Text color="white" wrap="truncate-start">
        {hint}
      </Text>
      <Box flexShrink={0}>
        <Text color="white">{clock}</Text>
      </Box>
    </Box>
  )
}
