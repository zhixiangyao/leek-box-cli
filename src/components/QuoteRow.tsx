import type { Row } from '../lib/columns.ts'
import Text from './Text.tsx'

type Props = {
  segments: Row
  selected?: boolean
  bright?: boolean
}

export default function QuoteRow(props: Props) {
  const { segments, selected, bright = false } = props

  return (
    <Text bright={bright} inverse={selected}>
      {segments.map((segment, index) => (
        <Text key={index} bright={bright} color={segment.color}>
          {segment.text}
        </Text>
      ))}
    </Text>
  )
}
