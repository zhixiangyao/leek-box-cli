import { Newline } from 'ink'

import ActionResult from '../../components/ActionResult.tsx'
import Text from '../../components/Text.tsx'
import TextInput from '../../components/TextInput.tsx'
import { useRemoveStockStore } from '../../stores/useRemoveStockStore.ts'
import { useRemoveStockPage } from './hooks/useRemoveStock.ts'

export default function RemoveStock() {
  const step = useRemoveStockStore((state) => state.step)
  const indexInput = useRemoveStockStore((state) => state.indexInput)
  const confirmInput = useRemoveStockStore((state) => state.confirmInput)
  const handleChoice = useRemoveStockStore((state) => state.handleChoice)
  const handleConfirm = useRemoveStockStore((state) => state.handleConfirm)

  useRemoveStockPage()

  if (step.type === 'loading') return <Text color="cyan">正在加载自选股...</Text>

  if (step.type === 'select') {
    return (
      <>
        <Text color="gray">自选股列表:</Text>
        {step.entries.map((entry, index) => (
          <Text key={entry.code}>
            {index + 1}) {entry.name} ({entry.code}) <Text color="gray">({entry.addedAt.slice(0, 10)})</Text>
          </Text>
        ))}
        {indexInput.error && <Text color="red">{indexInput.error}</Text>}
        <Newline />
        <TextInput
          resetToken={`index-${indexInput.resetToken}`}
          prompt="请输入要删除的序号: "
          onSubmit={handleChoice}
        />
      </>
    )
  }

  if (step.type === 'confirm') {
    return (
      <>
        <Text color="yellow">
          确定删除 {step.entry.name} ({step.entry.code})?
        </Text>
        {confirmInput.error && <Text color="red">{confirmInput.error}</Text>}
        <TextInput
          resetToken={`confirm-${confirmInput.resetToken}`}
          prompt="确认删除? (y/n): "
          onSubmit={handleConfirm}
        />
      </>
    )
  }

  if (step.type === 'removing') {
    return (
      <Text color="cyan">
        正在删除 {step.entry.name} ({step.entry.code})...
      </Text>
    )
  }

  if (step.type === 'done') return <ActionResult tone="success" msg={step.message} />
  if (step.type === 'error') return <ActionResult tone="error" msg={step.message} />
  return null
}
