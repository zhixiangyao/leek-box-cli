import { Box, Text } from 'ink'
import { useEffect, useState } from 'react'

import { SCREEN_META } from '../lib/screens.ts'
import { useRouterStore } from '../stores/useRouterStore.ts'

export default function StatusBar() {
  const screen = useRouterStore((state) => state.screen)
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
    <Box width="100%" height={1} justifyContent="space-between" paddingX={1} backgroundColor="blue">
      <Text color="white" wrap="truncate-start">
        {hint}
      </Text>
      <Box flexShrink={0}>
        <Text color="white">{date}</Text>
      </Box>
    </Box>
  )
}
