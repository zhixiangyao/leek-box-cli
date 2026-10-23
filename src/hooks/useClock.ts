import { useEffect, useState } from 'react'

/** 时区固定上海 (A股行情时区, 不要用本地时区) */
const TIME_ZONE = 'Asia/Shanghai'

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** 拼成 'YYYY-MM-DD HH:MM:SS' */
function formatClock(now: Date): string {
  const parts = formatter.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`
}

/** 上海时区时钟, 内部每秒刷新 */
export function useClock(): string {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return formatClock(now)
}
