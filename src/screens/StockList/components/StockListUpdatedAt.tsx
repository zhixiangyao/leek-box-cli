import Text from '../../../components/Text.tsx'
import { useSettingsStore } from '../../../stores/useSettingsStore.ts'
import { useStockListStore } from '../../../stores/useStockListStore.ts'

export default function StockListUpdatedAt() {
  const updatedAt = useStockListStore((state) => (state.step.type === 'table' ? state.step.updatedAt : undefined))
  const pollIntervalMs = useSettingsStore((state) => state.quotePollIntervalMs)

  if (updatedAt === undefined) return undefined

  return (
    <Text color="cyan">
      {updatedAt} ({pollIntervalMs}ms)
    </Text>
  )
}
