import { Newline } from 'ink'

import type { Screen } from '../cli/registry.ts'
import { useRouterStore } from '../stores/useRouterStore.ts'
import Message, { type MessageTone } from './Message.tsx'
import TextInput from './TextInput.tsx'

type Props = {
  tone: MessageTone
  msg: string
  to: Screen
  onReturn?: () => void | Promise<void>
}

export default function ActionResult({ tone, msg, to, onReturn }: Props) {
  const goTo = useRouterStore((state) => state.goTo)

  const handleReturn = () => {
    void onReturn?.()
    goTo(to)
  }

  return (
    <>
      <Message tone={tone} msg={msg} />
      <Newline />
      <TextInput prompt="按 Enter 返回操作页..." onSubmit={handleReturn} />
    </>
  )
}
