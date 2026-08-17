import type { ReactNode } from 'react'

import Text from './Text.tsx'

export type MessageTone = 'error' | 'warning' | 'success'

const TONE_COLOR: Record<MessageTone, 'red' | 'yellow' | 'green'> = {
  error: 'red',
  warning: 'yellow',
  success: 'green',
}

type Props = {
  tone: MessageTone
  children: ReactNode
}

export default function Message({ tone, children }: Props) {
  return (
    <Text bold color={TONE_COLOR[tone]}>
      {children}
    </Text>
  )
}
