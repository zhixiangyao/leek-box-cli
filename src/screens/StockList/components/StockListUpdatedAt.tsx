import Text from '../../../components/Text.tsx'
import { useStockListStore } from '../../../stores/useStockListStore.ts'

export default function StockListUpdatedAt() {
  const updatedAt = useStockListStore((state) => (state.step.type === 'table' ? state.step.updatedAt : undefined))
  const pollIntervalMs = useStockListStore((state) => state.pollIntervalMs)

  if (updatedAt === undefined) return undefined

  return (
    <Text color="cyan">
      {updatedAt} ({pollIntervalMs}ms)
    </Text>
  )
}
