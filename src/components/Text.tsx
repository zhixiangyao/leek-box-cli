import { Text as InkText, type TextProps } from 'ink'

import { useOverlayOpen } from '../hooks/useOverlayOpen.ts'
import { useTheme } from '../hooks/useTheme.ts'

type Props = {
  bright?: boolean
} & Omit<TextProps, 'dimColor'>

export default function Text({ bright = false, color, ...props }: Props) {
  const overlayOpen = useOverlayOpen()
  const theme = useTheme()
  const dimColor = bright ? false : overlayOpen.open

  return <InkText {...props} color={color ?? theme.foreground} dimColor={dimColor} />
}
