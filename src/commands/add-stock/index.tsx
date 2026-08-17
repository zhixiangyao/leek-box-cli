import { Box, Text } from 'ink'

import ActionResult from '../../components/ActionResult.tsx'
import TextInput from '../../components/TextInput.tsx'
import { useAddStock } from './useAddStock.ts'

type Props = {
  onBack: () => void
  /** 菜单弹窗打开时禁用输入 */
  isActive: boolean
}

export default function AddStock({ onBack, isActive }: Props) {
  const { step, codeInputError, codeInputKey, confirmInputError, confirmInputKey, handleCodeInput, handleConfirm } =
    useAddStock()

  if (step.type === 'input-code') {
    return (
      <>
        <Box marginBottom={1}>
          <Text color="cyan">添加自选股</Text>
        </Box>
        <Text color="gray">支持 600000 / sh600000 / 600000.SH 等写法</Text>
        {codeInputError && <Text color="red">{codeInputError}</Text>}
        <TextInput isActive={isActive} key={codeInputKey} prompt="请输入股票代码: " onSubmit={handleCodeInput} />
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
      <ActionResult tone="warning" onBack={onBack} isActive={isActive}>
        {step.name} ({step.code}) 已在自选股中.
      </ActionResult>
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
