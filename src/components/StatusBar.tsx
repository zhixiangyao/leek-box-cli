import { Box } from 'ink'
import { useEffect, useState } from 'react'

import { useOverlayOpen } from '../hooks/useOverlayOpen.ts'
import Text from './Text.tsx'

type Props = {
  hint: string
}

export default function StatusBar({ hint }: Props) {
  const overlayOpen = useOverlayOpen()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // en-CA locale 恰好输出 YYYY-MM-DD; timeZone 固定中国上海
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  return (
    <Box
      width="100%"
      height={1}
      justifyContent="space-between"
      paddingX={1}
      // 任一浮层弹窗打开时背景变灰, 配合本地 Text 的 overlayOpen 订阅形成整体遮罩
      backgroundColor={overlayOpen ? 'gray' : 'blue'}
    >
      <Text color="white" wrap="truncate-start">
        {hint}
      </Text>
      <Box flexShrink={0}>
        <Text color="white">{date}</Text>
      </Box>
    </Box>
  )
}
