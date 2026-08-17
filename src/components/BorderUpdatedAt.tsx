import { Box } from 'ink'

import { useDashboardStore } from '../stores/useDashboardStore.ts'
import { useRouterStore } from '../stores/useRouterStore.ts'
import Text from './Text.tsx'

export default function BorderUpdatedAt() {
  const routerStore = useRouterStore()
  const dashboardStore = useDashboardStore()

  if (routerStore.screen !== 'dashboard' || dashboardStore.step.type !== 'table') {
    return null
  }

  return (
    <Box position="absolute" top={0} right={2}>
      <Text>|</Text>
      <Text color="cyan">
        {dashboardStore.step.updatedAt} ({dashboardStore.pollIntervalMs}ms)
      </Text>
      <Text>|</Text>
    </Box>
  )
}
