import { Box, type BoxProps } from 'ink'
import type { ReactNode } from 'react'

import { useTheme } from '../../../hooks/useTheme.ts'
import Text from '../../Text.tsx'

/** 网格单元格槽位: 等分行宽, 空条目也占位保持列对齐 */
export function GridCellSlot(props: BoxProps & { children?: ReactNode }) {
  return <Box flexGrow={1} flexBasis={0} minWidth={0} {...props} />
}

type Props = {
  label: string
  hint?: string
  selected: boolean
  cursor: boolean
}

export default function GridCell({ label, hint, selected, cursor }: Props) {
  const theme = useTheme()

  return (
    <GridCellSlot>
      <Text inverse={cursor} wrap="truncate-end">
        <Text color={selected ? theme.primary : undefined}>
          {selected ? '[x] ' : '[ ] '}
          {label}
        </Text>
        {hint ? <Text color="gray"> ({hint})</Text> : undefined}
      </Text>
    </GridCellSlot>
  )
}
