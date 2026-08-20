import { Text as InkText, type TextProps } from 'ink'

import { useOverlayOpen } from '../hooks/useOverlayOpen.ts'

type Props = {
  bright?: boolean
} & Omit<TextProps, 'dimColor'>

export default function Text({ bright = false, ...props }: Props) {
  const overlayOpen = useOverlayOpen()
  const dimColor = bright ? false : overlayOpen

  return <InkText {...props} dimColor={dimColor} />
}
