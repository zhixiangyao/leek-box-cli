import { Newline } from 'ink'
import { type ReactNode } from 'react'

import ActionResult from '../../components/ActionResult.tsx'
import Card from '../../components/Card.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import TextInput from '../../components/TextInput.tsx'
import { useOverlayOpen } from '../../hooks/useOverlayOpen.ts'
import { useTheme } from '../../hooks/useTheme.ts'
import { useRemoveStock } from './hooks/useRemoveStock.ts'

type Props = {
  title: string
  hint: string
}

export default function RemoveStock({ title, hint }: Props) {
  const overlayOpen = useOverlayOpen()
  const theme = useTheme()
  const { step, indexInput, confirmInput, handleChoice, handleConfirm } = useRemoveStock()
  let content: ReactNode

  switch (step.type) {
    case 'loading': {
      content = <Text color="cyan">正在加载自选股...</Text>
      break
    }

    case 'select': {
      content = (
        <>
          <Text color="gray">自选股列表:</Text>
          {step.entries.map((entry, index) => (
            <Text key={entry.code}>
              {index + 1}) {entry.name} ({entry.code}) <Text color="gray">({entry.addedAt.slice(0, 10)})</Text>
            </Text>
          ))}
          {indexInput.error && <Text color="red">{indexInput.error}</Text>}
          <Newline />
          <TextInput key={`index-${indexInput.resetToken}`} prompt="请输入要删除的序号: " onSubmit={handleChoice} />
        </>
      )
      break
    }

    case 'confirm': {
      content = (
        <>
          <Text color="yellow">
            确定删除 {step.entry.name} ({step.entry.code})?
          </Text>
          {confirmInput.error && <Text color="red">{confirmInput.error}</Text>}
          <TextInput key={`confirm-${confirmInput.resetToken}`} prompt="确认删除? (y/n): " onSubmit={handleConfirm} />
        </>
      )
      break
    }

    case 'removing': {
      content = (
        <Text color="cyan">
          正在删除 {step.entry.name} ({step.entry.code})...
        </Text>
      )
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
