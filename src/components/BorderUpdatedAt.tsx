import { Box } from 'ink'

import { useRouterStore } from '../stores/useRouterStore.ts'
import { useStockListStore } from '../stores/useStockListStore.ts'
import Text from './Text.tsx'

export default function BorderUpdatedAt() {
  const routerStore = useRouterStore()
  const stockListStore = useStockListStore()

  if (routerStore.screen !== 'stock-list' || stockListStore.step.type !== 'table') {
    return null
  }

  return (
    <Box position="absolute" top={0} right={2}>
      <Text>|</Text>
      <Text color="cyan">
        {stockListStore.step.updatedAt} ({stockListStore.pollIntervalMs}ms)
      </Text>
      <Text>|</Text>
    </Box>
  )
}
