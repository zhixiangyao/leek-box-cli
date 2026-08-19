import Text from './Text.tsx'

export type MessageTone = 'error' | 'warning' | 'success'

const TONE_COLOR: Record<MessageTone, 'red' | 'yellow' | 'green'> = {
  error: 'red',
  warning: 'yellow',
  success: 'green',
}

type Props = {
  tone: MessageTone
  msg: string
}

export default function Message({ tone, msg }: Props) {
  return (
    <Text bold color={TONE_COLOR[tone]}>
      {msg}
    </Text>
  )
}
