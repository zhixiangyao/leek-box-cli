import { type ReactNode } from 'react'

import ActionResult from '../../components/ActionResult.tsx'
import Card from '../../components/Card.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import TextInput from '../../components/TextInput.tsx'
import { useOverlayOpen } from '../../hooks/useOverlayOpen.ts'
import { useTheme } from '../../hooks/useTheme.ts'
import { formatPrice } from '../../lib/format.ts'
import { useStockAdd } from './hooks/useStockAdd.ts'

type Props = {
  title: string
  hint: string
}

export default function StockAdd({ title, hint }: Props) {
  const overlayOpen = useOverlayOpen()
  const theme = useTheme()
  const { step, codeInput, confirmInput, handleCodeInput, handleConfirm } = useStockAdd()
  let content: ReactNode

  switch (step.type) {
    case 'input-code': {
      content = (
        <>
          {codeInput.error && <Text color="red">{codeInput.error}</Text>}
          <TextInput
            key={`code-${codeInput.resetToken}`}
            prompt="请输入股票代码: "
            placeholder={<Text color="gray">支持 600000 / sh600000 / 600000.SH 等写法</Text>}
            onSubmit={handleCodeInput}
          />
        </>
      )
      break
    }

    case 'checking': {
      content = <Text color="cyan">正在验证股票代码 {step.code}...</Text>
      break
    }

    case 'confirm': {
      content = (
        <>
          <Text color="cyan">
            找到: {step.name} ({step.code}), 现价 {formatPrice(step.current)}
          </Text>
          {confirmInput.error && <Text color="red">{confirmInput.error}</Text>}
          <TextInput
            key={`confirm-${confirmInput.resetToken}`}
            prompt="确认添加到自选股? (y/n): "
            onSubmit={handleConfirm}
          />
        </>
      )
      break
    }

    case 'saving': {
      content = (
        <Text color="cyan">
          正在添加 {step.name} ({step.code})...
        </Text>
      )
      break
    }

    case 'already-exists': {
      content = <ActionResult tone="warning" msg={`${step.name} (${step.code}) 已在自选股中.`} />
      break
    }

    case 'done': {
      content = <ActionResult tone="success" msg={step.message} />
      break
    }

    case 'error': {
      content = <ActionResult tone="error" msg={step.message} />
      break
    }
  }

  return (
    <Card
      fullScreen
      bright={!overlayOpen}
      title={<Text color={theme.primary}>{title}</Text>}
      footer={<StatusBar hint={hint} bright={!overlayOpen} />}
    >
      {content}
    </Card>
  )
}
