import { Newline } from 'ink'

import { useTranslation } from '../hooks/useTranslation.ts'
import type { Command } from '../navigation/registry.ts'
import { useCommandStore } from '../stores/useCommandStore.ts'
import Message, { type MessageTone } from './Message.tsx'
import TextInput from './TextInput.tsx'

type Props = {
  tone: MessageTone
  msg: string
  to: Command
  onReturn?: () => void | Promise<void>
}

export default function ActionResult({ tone, msg, to, onReturn }: Props) {
  const { t } = useTranslation()
  const setCommand = useCommandStore((state) => state.setCommand)

  const handleReturn = () => {
    void onReturn?.()
    setCommand(to)
  }

  return (
    <>
      <Message tone={tone} msg={msg} />
      <Newline />
      <TextInput prompt={t('common.returnPrompt')} onSubmit={handleReturn} />
    </>
  )
}
