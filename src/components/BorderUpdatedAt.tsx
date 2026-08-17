import { Box, Text } from 'ink'

import { useDashboardStore } from '../stores/useDashboardStore.ts'
import { useRouterStore } from '../stores/useRouterStore.ts'

export default function BorderUpdatedAt() {
  const screen = useRouterStore((state) => state.screen)
  const step = useDashboardStore((state) => state.step)
  const pollIntervalMs = useDashboardStore((state) => state.pollIntervalMs)

  if (screen !== 'dashboard' || step.type !== 'table') {
    return null
  }

  return (
    <Box position="absolute" top={0} right={2}>
      <Text>|</Text>
      <Text color="cyan">
        {step.updatedAt} ({pollIntervalMs}ms)
      </Text>
      <Text>|</Text>
    </Box>
  )
}
