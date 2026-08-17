import { Box, BoxProps, useInput } from 'ink'
import { ReactNode, useState } from 'react'

import { useRouterStore } from '../stores/useRouterStore.ts'
import Text from './Text.tsx'

type Props = {
  prompt: string
  onSubmit: (value: string) => void
  /** 占位符 */
  placeholder?: string | ReactNode
} & BoxProps

export default function TextInput(props: Props) {
  const { prompt, onSubmit, placeholder, ...boxProps } = props
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const menuOpen = useRouterStore((state) => state.menuOpen)

  useInput(
    (input, key) => {
      if (submitted) return

      if (key.return) {
        setSubmitted(true)
        onSubmit(value)
      } else if (key.backspace || key.delete) {
        setValue((prev) => prev.slice(0, -1))
      } else if (!key.ctrl && !key.meta && input && input.length > 0) {
        setValue((prev) => prev + input)
      }
    },
    { isActive: !menuOpen && !submitted },
  )

  return (
    <Box {...boxProps}>
      <Text>
        {prompt}
        {submitted ? (
          <Text color="green">{value}</Text>
        ) : (
          <Text>
            {value}
            <Text color="gray">█</Text>
            {value || !placeholder ? null : placeholder}
          </Text>
        )}
      </Text>
    </Box>
  )
}
