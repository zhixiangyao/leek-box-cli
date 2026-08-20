import { useEffect, useState } from 'react'

/** 时钟格式: 决定返回的时间字符串形态 */
export type ClockFormat = 'date-time' | 'date' | 'time' | 'hour-minute'

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

/** 按格式拼时间字符串: 'YYYY-MM-DD HH:MM:SS' / 'YYYY-MM-DD' / 'HH:MM:SS' / 'HH:MM' */
function formatClock(now: Date, format: ClockFormat): string {
  const parts = formatter.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const date = `${part('year')}-${part('month')}-${part('day')}`
  const time = `${part('hour')}:${part('minute')}`
  switch (format) {
    case 'date-time':
      return `${date} ${time}:${part('second')}`
    case 'date':
      return date
    case 'time':
      return `${time}:${part('second')}`
    case 'hour-minute':
      return time
  }
}

/** 含秒的格式才需要每秒刷新, 否则每分刷新即可 */
const TICK_MS: Record<ClockFormat, number> = {
  'date-time': 1000,
  date: 60_000,
  time: 1000,
  'hour-minute': 60_000,
}

/** 上海时区时钟: 按 format 返回不同形态的时间字符串, 内部自刷新 (含秒每秒, 否则每分) */
export function useClock(format: ClockFormat): string {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS[format])
    return () => clearInterval(timer)
  }, [format])

  return formatClock(now, format)
}
