import { Box, Text } from 'ink'
import { useEffect, useState } from 'react'

type Props = {
  /** 左侧提示信息 (如按键提示) */
  hint: string
}

/** 底部状态栏: 左侧提示信息, 右侧 YYYY-MM-DD (时区固定 Asia/Shanghai) */
export default function StatusBar({ hint }: Props) {
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
