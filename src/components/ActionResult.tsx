import type { ReactNode } from 'react'

import BackToDashboard from './BackToDashboard.tsx'
import Message, { type MessageTone } from './Message.tsx'

type Props = {
  tone: MessageTone
  onBack: () => void
  /** 菜单弹窗打开时禁用返回键 */
  isActive: boolean
  children: ReactNode
}

/** 命令页 (add-stock / remove-stock) 的结果消息 + 返回看板提示 */
export default function ActionResult({ tone, onBack, isActive, children }: Props) {
  return (
    <>
      <Message tone={tone}>{children}</Message>
      <BackToDashboard onBack={onBack} isActive={isActive} />
    </>
  )
}
