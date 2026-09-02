import { Box } from 'ink'

import { useClock } from '../hooks/useClock.ts'
import { useTheme } from '../hooks/useTheme.ts'
import Text from './Text.tsx'

function Clock({ bright = false }: Pick<Props, 'bright'>) {
  const clock = useClock('date-time')

  return (
    <Text bright={bright} color="white">
      {clock}
    </Text>
  )
}

type Props = {
  hint?: string
  bright?: boolean
  showClock?: boolean
}

export default function StatusBar(props: Props) {
  const { hint, bright = false, showClock = false } = props
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
