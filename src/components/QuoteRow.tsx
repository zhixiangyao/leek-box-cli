import type { Row } from '../lib/quoteTable.ts'
import Text from './Text.tsx'

type Props = {
  /** 默认为 false */
  bright?: boolean
  segments: Row
  selected?: boolean
}

export default function QuoteRow(props: Props) {
  const { bright = false, segments, selected } = props

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
