import { Box } from 'ink'

import { useClock } from '../hooks/useClock.ts'
import { useTheme } from '../hooks/useTheme.ts'
import Text from './Text.tsx'

type Props = {
  hint?: string
  bright?: boolean
}

export default function StatusBar(props: Props) {
  const { hint, bright = false } = props
  const clock = useClock('date-time')
  const theme = useTheme()

  return (
    <Box justifyContent="space-between" paddingX={1} backgroundColor={bright ? theme.accent : 'gray'}>
      <Box flexShrink={0}>
        {hint && (
          <Text bright={bright} color="white">
            {hint}
          </Text>
        )}
      </Box>

      <Box flexShrink={0}>
        <Text bright={bright} color="white">
          {clock}
        </Text>
      </Box>
    </Box>
  )
}
