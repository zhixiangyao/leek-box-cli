import type { ReactNode } from 'react'

import BackToDashboard from './BackToDashboard.tsx'
import Message, { type MessageTone } from './Message.tsx'

type Props = {
  tone: MessageTone
  children: ReactNode
}

/** 命令页 (add-stock / remove-stock) 的结果消息 + 返回看板提示 */
export default function ActionResult({ tone, children }: Props) {
  return (
    <>
      <Message tone={tone}>{children}</Message>
      <BackToDashboard />
    </>
  )
}
