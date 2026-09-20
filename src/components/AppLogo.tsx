import { Box } from 'ink'

import { useTheme } from '../hooks/useTheme.ts'
import Text from './Text.tsx'

/** ASCII art 各行, 必须等宽 */
export const LOGO_LINES = ['█   █▀▀ █▀▀ █▄▀   █▄▄ █▀█ ▀▄▀   █▀▀ █   █', '█▄▄ ██▄ ██▄ █ █   █▄█ █▄█ █ █   █▄▄ █▄▄ █']

type Props = {
  /** 默认为 false */
  bright?: boolean
}

export default function AppLogo(props: Props) {
  const { bright = false } = props
  const theme = useTheme()

  return (
    <Box flexDirection="column">
      {LOGO_LINES.map((line) => (
        <Text key={line} bright={bright} color={theme.primary}>
          {line}
        </Text>
      ))}
    </Box>
  )
}
