import { Box } from 'ink'
import { useEffect, useState } from 'react'

import { SCREEN_META } from '../lib/screens.ts'
import { useRouterStore } from '../stores/useRouterStore.ts'
import Text from './Text.tsx'

export default function StatusBar() {
  const screen = useRouterStore((state) => state.screen)
  const menuOpen = useRouterStore((state) => state.menuOpen)
  const hint = SCREEN_META[screen].hint
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
      // 菜单打开时背景变灰, 配合本地 Text 的 menuOpen 订阅形成整体遮罩
      backgroundColor={menuOpen ? 'gray' : 'blue'}
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
