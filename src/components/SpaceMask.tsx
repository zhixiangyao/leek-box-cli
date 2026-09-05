import { Box } from 'ink'

import Text from './Text.tsx'

type Props = {
  /** 默认为 false */
  bright?: boolean
  width: number
  height: number
}

export default function SpaceMask(props: Props) {
  const { bright = false, width, height } = props
  const emptyRow = ' '.repeat(width)
  const rows = Array.from({ length: height })

  return (
    <Box position="absolute" flexDirection="column">
      {rows.map((_, index) => (
        <Text key={index} bright={bright}>
          {emptyRow}
        </Text>
      ))}
    </Box>
  )
}
