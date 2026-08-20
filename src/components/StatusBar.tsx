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
    <Box width="100%" justifyContent="space-between" paddingX={1} backgroundColor={overlayOpen ? 'gray' : 'blue'}>
      <Text color="white" wrap="truncate-start">
        {hint}
      </Text>
      <Box flexShrink={0}>
        <Text color="white">{clock}</Text>
      </Box>
    </Box>
  )
}
