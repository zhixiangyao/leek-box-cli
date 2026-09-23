import { Newline } from 'ink'

import { useTranslation } from '../hooks/useTranslation.ts'
import Message, { type MessageTone } from './Message.tsx'
import TextInput, { type TextInputProps } from './TextInput.tsx'

type Props = {
  tone: MessageTone
  msg: string
} & Pick<TextInputProps, 'isActive' | 'onSubmit'>

export default function ActionResult(props: Props) {
  const { tone, msg } = props
  const { isActive, onSubmit } = props
  const { t } = useTranslation()

  return (
    <>
      <Message tone={tone} msg={msg} />
      <Newline />
      <TextInput prompt={t('common.returnPrompt')} isActive={isActive} onSubmit={onSubmit} />
    </>
  )
}
