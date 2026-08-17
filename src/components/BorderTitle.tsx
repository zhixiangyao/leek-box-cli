import { Box } from 'ink'

import { SCREEN_META } from '../lib/screens.ts'
import { useRouterStore } from '../stores/useRouterStore.ts'
import Text from './Text.tsx'

export default function BorderTitle() {
  const screen = useRouterStore((state) => state.screen)

  const title = SCREEN_META[screen].title

  return (
    <Box position="absolute" top={0} left={2}>
      <Text>|</Text>
      <Text color="magenta">{title}</Text>
      <Text>|</Text>
    </Box>
  )
}
