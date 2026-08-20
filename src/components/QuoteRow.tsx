import { Text as InkText } from 'ink'

import type { Row } from '../lib/columns.ts'
import Text from './Text.tsx'

type Props = { segments: Row; selected?: boolean; bright?: boolean }

export default function QuoteRow(props: Props) {
  const { segments, selected, bright = false } = props
  const TextComponent = bright ? InkText : Text

  return (
    <TextComponent inverse={selected}>
      {segments.map((segment, index) => (
        <TextComponent key={index} color={segment.color}>
          {segment.text}
        </TextComponent>
      ))}
    </TextComponent>
  )
}
