import { type ReactNode } from 'react'

import ActionResult from '../../components/ActionResult.tsx'
import Card from '../../components/Card.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import TextInput from '../../components/TextInput.tsx'
import { useOverlayOpen } from '../../hooks/useOverlayOpen.ts'
import { useTheme } from '../../hooks/useTheme.ts'
import { formatPrice } from '../../lib/format.ts'
import { isAddResultStep } from '../../stores/useStockAddStore.ts'
import { useStockAdd } from './hooks/useStockAdd.ts'

type Props = {
  title: string
  hint: string
}

export default function StockAdd({ title, hint }: Props) {
  const overlayOpen = useOverlayOpen()
  const theme = useTheme()
  const { step, codeInput, confirmInput, handleCodeInput, handleConfirm, reset } = useStockAdd()
  let content: ReactNode

  if (isAddResultStep(step)) {
    content = (
      <ActionResult
        tone={step.type === 'already-exists' ? 'warning' : step.type === 'done' ? 'success' : 'error'}
        msg={
          step.type === 'already-exists'
            ? `${step.entries.map((entry) => `${entry.name} (${entry.code})`).join(', ')} 已在自选股中.`
            : step.message
        }
        to="stock-add"
        onReturn={reset}
      />
    )
  } else {
    switch (step.type) {
      case 'input-code': {
        content = (
          <>
            {codeInput.error && <Text color="red">{codeInput.error}</Text>}
            <TextInput
              key={`code-${codeInput.resetToken}`}
              prompt="请输入股票代码, 用英文逗号分隔: "
              placeholder={<Text color="gray">支持 600000, sh600000, 600000.SH 等写法</Text>}
              onSubmit={handleCodeInput}
            />
          </>
        )
        break
      }

      case 'checking': {
        content = <Text color="cyan">正在验证股票代码: {step.codes.join(', ')}...</Text>
        break
      }

      case 'confirm': {
        content = (
          <>
            <Text color="cyan">找到以下股票:</Text>
            {step.entries.map((entry) => (
              <Text key={entry.code}>
                {entry.name} ({entry.code}), 现价 {formatPrice(entry.current)}
              </Text>
            ))}
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
        content = <Text color="cyan">正在添加 {step.entries.length} 个股票...</Text>
        break
      }
    }
  }

  return (
    <Card
      fullScreen
      bright={!overlayOpen.open}
      title={<Text color={theme.primary}>{title}</Text>}
      footer={<StatusBar showClock hint={hint} bright={!overlayOpen.open} />}
    >
      {content}
    </Card>
  )
}
