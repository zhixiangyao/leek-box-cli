import { Newline } from 'ink'

import ActionResult from '../../components/ActionResult.tsx'
import Text from '../../components/Text.tsx'
import TextInput from '../../components/TextInput.tsx'
import { useRemoveStockStore } from '../../stores/useRemoveStockStore.ts'
import { useRemoveStockPage } from './hooks/useRemoveStock.ts'

export default function RemoveStock() {
  const removeStockStore = useRemoveStockStore()

  useRemoveStockPage()

  if (removeStockStore.step.type === 'loading') {
    return <Text color="cyan">正在加载自选股...</Text>
  }

  if (removeStockStore.step.type === 'select') {
    return (
      <>
        <Text color="gray">自选股列表:</Text>
        {removeStockStore.step.entries.map((entry, index) => (
          <Text key={entry.code}>
            {index + 1}) {entry.name} ({entry.code}) <Text color="gray">({entry.addedAt.slice(0, 10)})</Text>
          </Text>
        ))}
        {removeStockStore.indexInputError && <Text color="red">{removeStockStore.indexInputError}</Text>}
        <Newline />
        <TextInput
          key={removeStockStore.indexInputKey}
          prompt="请输入要删除的序号: "
          onSubmit={removeStockStore.handleChoice}
        />
      </>
    )
  }

  if (removeStockStore.step.type === 'confirm') {
    return (
      <>
        <Text color="yellow">
          确定删除 {removeStockStore.step.entry.name} ({removeStockStore.step.entry.code})?
        </Text>
        {removeStockStore.confirmInputError && <Text color="red">{removeStockStore.confirmInputError}</Text>}
        {/* key 加字符串前缀: select 步输入框 key 是数字序列, 若相同 React 会复用实例继承旧值, 导致 y/n 无法输入 */}
        <TextInput
          key={`yn-${removeStockStore.confirmInputKey}`}
          prompt="确认删除? (y/n): "
          onSubmit={removeStockStore.handleConfirm}
        />
      </>
    )
  }

  if (removeStockStore.step.type === 'done') {
    return <ActionResult tone="success" msg={removeStockStore.step.message} />
  }

  if (removeStockStore.step.type === 'error') {
    return <ActionResult tone="error" msg={removeStockStore.step.message} />
  }

  return null
}
