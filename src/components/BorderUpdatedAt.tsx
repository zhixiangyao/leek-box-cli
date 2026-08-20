import { Box } from 'ink'

import { useRouterStore } from '../stores/useRouterStore.ts'
import { useStockListStore } from '../stores/useStockListStore.ts'
import Text from './Text.tsx'

export default function BorderUpdatedAt() {
  const screen = useRouterStore((state) => state.screen)
  const updatedAt = useStockListStore((state) => (state.step.type === 'table' ? state.step.updatedAt : null))
  const pollIntervalMs = useStockListStore((state) => state.pollIntervalMs)

  if (screen !== 'stock-list' || updatedAt === null) return null

  return (
    <Box position="absolute" top={0} right={2}>
      <Text>|</Text>
      <Text color="cyan">
        {updatedAt} ({pollIntervalMs}ms)
      </Text>
      <Text>|</Text>
    </Box>
  )
}
