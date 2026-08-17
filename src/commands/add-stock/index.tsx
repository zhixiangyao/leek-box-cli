import { Text } from 'ink'

import ActionResult from '../../components/ActionResult.tsx'
import TextInput from '../../components/TextInput.tsx'
import { useAddStockStore } from '../../stores/useAddStockStore.ts'
import { useAddStockPage } from './hooks/useAddStock.ts'

type Props = {
  /** 菜单弹窗打开时禁用输入 */
  isActive: boolean
}

export default function AddStock({ isActive }: Props) {
  const step = useAddStockStore((state) => state.step)
  const codeInputError = useAddStockStore((state) => state.codeInputError)
  const codeInputKey = useAddStockStore((state) => state.codeInputKey)
  const confirmInputError = useAddStockStore((state) => state.confirmInputError)
  const confirmInputKey = useAddStockStore((state) => state.confirmInputKey)
  const handleCodeInput = useAddStockStore((state) => state.handleCodeInput)
  const handleConfirm = useAddStockStore((state) => state.handleConfirm)

  useAddStockPage()

  if (step.type === 'input-code') {
    return (
      <>
        {codeInputError && <Text color="red">{codeInputError}</Text>}
        <TextInput
          isActive={isActive}
          key={codeInputKey}
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
          找到: {step.name} ({step.code}), 现价 {step.current > 0 ? step.current.toFixed(2) : '--'}
        </Text>
        {confirmInputError && <Text color="red">{confirmInputError}</Text>}
        <TextInput
          isActive={isActive}
          key={confirmInputKey}
          prompt="确认添加到自选股? (y/n): "
          onSubmit={handleConfirm}
        />
      </>
    )
  }

  if (step.type === 'already-exists') {
    return (
      <ActionResult tone="warning" isActive={isActive}>
        {step.name} ({step.code}) 已在自选股中.
      </ActionResult>
    )
  }

  if (step.type === 'done') {
    return (
      <ActionResult tone="success" isActive={isActive}>
        {step.message}
      </ActionResult>
    )
  }

  if (step.type === 'error') {
    return (
      <ActionResult tone="error" isActive={isActive}>
        {step.message}
      </ActionResult>
    )
  }

  return null
}
