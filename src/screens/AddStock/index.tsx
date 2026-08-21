import ActionResult from '../../components/ActionResult.tsx'
import Text from '../../components/Text.tsx'
import TextInput from '../../components/TextInput.tsx'
import { formatPrice } from '../../lib/format.ts'
import { useAddStockStore } from '../../stores/useAddStockStore.ts'
import { useAddStockPage } from './hooks/useAddStock.ts'

export default function AddStock() {
  const step = useAddStockStore((state) => state.step)
  const codeInput = useAddStockStore((state) => state.codeInput)
  const confirmInput = useAddStockStore((state) => state.confirmInput)
  const handleCodeInput = useAddStockStore((state) => state.handleCodeInput)
  const handleConfirm = useAddStockStore((state) => state.handleConfirm)

  useAddStockPage()

  if (step.type === 'input-code') {
    return (
      <>
        {codeInput.error && <Text color="red">{codeInput.error}</Text>}
        <TextInput
          resetToken={`code-${codeInput.resetToken}`}
          prompt="请输入股票代码: "
          placeholder={<Text color="gray">支持 600000 / sh600000 / 600000.SH 等写法</Text>}
          onSubmit={handleCodeInput}
        />
      </>
    )
  }

  if (step.type === 'checking') {
    return <Text color="cyan">正在验证股票代码 {step.code}...</Text>
  }

  if (step.type === 'confirm') {
    return (
      <>
        <Text color="cyan">
          找到: {step.name} ({step.code}), 现价 {formatPrice(step.current)}
        </Text>
        {confirmInput.error && <Text color="red">{confirmInput.error}</Text>}
        <TextInput
          resetToken={`confirm-${confirmInput.resetToken}`}
          prompt="确认添加到自选股? (y/n): "
          onSubmit={handleConfirm}
        />
      </>
    )
  }

  if (step.type === 'saving') {
    return (
      <Text color="cyan">
        正在添加 {step.name} ({step.code})...
      </Text>
    )
  }

  if (step.type === 'already-exists') {
    return <ActionResult tone="warning" msg={`${step.name} (${step.code}) 已在自选股中.`} />
  }

  if (step.type === 'done') {
    return <ActionResult tone="success" msg={step.message} />
  }

  if (step.type === 'error') {
    return <ActionResult tone="error" msg={step.message} />
  }

  return undefined
}
