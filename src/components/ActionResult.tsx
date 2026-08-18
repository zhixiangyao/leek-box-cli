import type { ReactNode } from 'react'

import BackToDashboard from './BackToDashboard.tsx'
import Message, { type MessageTone } from './Message.tsx'

type Props = {
  tone: MessageTone
  children: ReactNode
}

export default function ActionResult({ tone, children }: Props) {
  return (
    <>
      <Message tone={tone}>{children}</Message>
      <BackToDashboard />
    </>
  )
}
