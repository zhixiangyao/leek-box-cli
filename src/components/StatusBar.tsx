import { Box } from 'ink'

import { useClock } from '../hooks/useClock.ts'
import { useTheme } from '../hooks/useTheme.ts'
import Text from './Text.tsx'

type ClockProps = Pick<StatusBarProps, 'bright'>

function Clock({ bright = false }: ClockProps) {
  const clock = useClock('date-time')

  return (
    <Text bright={bright} color="white">
      {clock}
    </Text>
  )
}

type StatusBarProps = {
  /** 默认为 false */
  bright?: boolean
  hint?: string
  showClock?: boolean
}

export default function StatusBar(props: StatusBarProps) {
  const { bright = false, hint, showClock = false } = props
  const theme = useTheme()

  return (
    <Box justifyContent="space-between" paddingX={1} minHeight={1} backgroundColor={bright ? theme.accent : 'gray'}>
      <Box flexShrink={0}>
        {hint && (
          <Text bright={bright} color="white">
            {hint}
          </Text>
        )}
      </Box>

      <Box flexShrink={0}>{showClock && <Clock bright={bright} />}</Box>
    </Box>
  )
}
