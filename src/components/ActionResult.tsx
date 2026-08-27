import { Newline } from 'ink'

import { useRouterStore } from '../stores/useRouterStore.ts'
import Message, { type MessageTone } from './Message.tsx'
import TextInput from './TextInput.tsx'

type Props = {
  tone: MessageTone
  msg: string
}

export default function ActionResult({ tone, msg }: Props) {
  const goTo = useRouterStore((state) => state.goTo)

  return (
    <>
      <Message tone={tone} msg={msg} />
      <Newline />
      <TextInput prompt="按 Enter 返回自选股票看板..." onSubmit={() => goTo('stock-list')} />
    </>
  )
}
