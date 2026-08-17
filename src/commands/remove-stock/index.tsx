import { Box, Text } from 'ink'

import ActionResult from '../../components/ActionResult.tsx'
import TextInput from '../../components/TextInput.tsx'
import { useRemoveStockStore } from '../../stores/useRemoveStockStore.ts'
import { useRemoveStockPage } from './hooks/useRemoveStock.ts'

type Props = {
  onBack: () => void
  /** 菜单弹窗打开时禁用输入 */
  isActive: boolean
}

export default function RemoveStock({ onBack, isActive }: Props) {
  const step = useRemoveStockStore((state) => state.step)
  const indexInputError = useRemoveStockStore((state) => state.indexInputError)
  const indexInputKey = useRemoveStockStore((state) => state.indexInputKey)
  const confirmInputError = useRemoveStockStore((state) => state.confirmInputError)
  const confirmInputKey = useRemoveStockStore((state) => state.confirmInputKey)
  const handleChoice = useRemoveStockStore((state) => state.handleChoice)
  const handleConfirm = useRemoveStockStore((state) => state.handleConfirm)

  useRemoveStockPage()

  if (step.type === 'loading') {
    return <Text color="cyan">正在加载自选股...</Text>
  }

  if (step.type === 'select') {
    return (
      <>
        <Box marginBottom={1}>
          <Text color="cyan">删除自选股</Text>
        </Box>
        <Text color="gray">自选股列表:</Text>
        {step.entries.map((entry, index) => (
          <Text key={entry.code}>
            {index + 1}) {entry.name} ({entry.code}) <Text color="gray">({entry.addedAt.slice(0, 10)})</Text>
          </Text>
        ))}
        {indexInputError && <Text color="red">{indexInputError}</Text>}
        <TextInput
          marginTop={1}
          isActive={isActive}
          key={indexInputKey}
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
        {confirmInputError && <Text color="red">{confirmInputError}</Text>}
        {/* key 加字符串前缀: select 步输入框 key 是数字序列, 若相同 React 会复用实例继承旧值, 导致 y/n 无法输入 */}
        <TextInput
          isActive={isActive}
          key={`yn-${confirmInputKey}`}
          prompt="确认删除? (y/n): "
          onSubmit={handleConfirm}
        />
      </>
    )
  }

  if (step.type === 'done') {
    return (
      <ActionResult tone="success" onBack={onBack} isActive={isActive}>
        {step.message}
      </ActionResult>
    )
  }

  if (step.type === 'error') {
    return (
      <ActionResult tone="error" onBack={onBack} isActive={isActive}>
        {step.message}
      </ActionResult>
    )
  }

  return null
}
