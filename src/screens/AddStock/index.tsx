import ActionResult from '../../components/ActionResult.tsx'
import Text from '../../components/Text.tsx'
import TextInput from '../../components/TextInput.tsx'
import { formatPrice } from '../../lib/format.ts'
import { useAddStockStore } from '../../stores/useAddStockStore.ts'
import { useAddStockPage } from './hooks/useAddStock.ts'

export default function AddStock() {
  const addStockStore = useAddStockStore()

  useAddStockPage()

  if (addStockStore.step.type === 'input-code') {
    return (
      <>
        {addStockStore.codeInput.error && <Text color="red">{addStockStore.codeInput.error}</Text>}
        <TextInput
          key={addStockStore.codeInput.key}
          prompt="请输入股票代码: "
          placeholder={<Text color="gray">支持 600000 / sh600000 / 600000.SH 等写法</Text>}
          onSubmit={addStockStore.handleCodeInput}
        />
      </>
    )
  }

  if (addStockStore.step.type === 'checking') {
    return <Text color="cyan">正在验证股票代码 {addStockStore.step.code}...</Text>
  }

  if (addStockStore.step.type === 'confirm') {
    return (
      <>
        <Text color="cyan">
          找到: {addStockStore.step.name} ({addStockStore.step.code}), 现价 {formatPrice(addStockStore.step.current)}
        </Text>
        {addStockStore.confirmInput.error && <Text color="red">{addStockStore.confirmInput.error}</Text>}
        <TextInput
          key={addStockStore.confirmInput.key}
          prompt="确认添加到自选股? (y/n): "
          onSubmit={addStockStore.handleConfirm}
        />
      </>
    )
  }

  if (addStockStore.step.type === 'saving') {
    return (
      <Text color="cyan">
        正在添加 {addStockStore.step.name} ({addStockStore.step.code})...
      </Text>
    )
  }

  if (addStockStore.step.type === 'already-exists') {
    return <ActionResult tone="warning" msg={`${addStockStore.step.name} (${addStockStore.step.code}) 已在自选股中.`} />
  }

  if (addStockStore.step.type === 'done') {
    return <ActionResult tone="success" msg={addStockStore.step.message} />
  }

  if (addStockStore.step.type === 'error') {
    return <ActionResult tone="error" msg={addStockStore.step.message} />
  }

  return null
}
