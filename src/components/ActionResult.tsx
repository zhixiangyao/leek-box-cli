import BackToStockList from './BackToStockList.tsx'
import Message, { type MessageTone } from './Message.tsx'

type Props = {
  tone: MessageTone
  msg: string
}

export default function ActionResult({ tone, msg }: Props) {
  return (
    <>
      <Message tone={tone} msg={msg} />
      <BackToStockList />
    </>
  )
}
