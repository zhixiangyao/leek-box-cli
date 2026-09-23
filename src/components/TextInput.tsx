import { Box, useInput } from 'ink'
import { type ReactNode, useState } from 'react'

import Text from './Text.tsx'

export type TextInputProps = {
  prompt: string
  onSubmit: (value: string) => void
  placeholder?: ReactNode
  /** 默认为 true */
  isActive?: boolean
}

export default function TextInput(props: TextInputProps) {
  const { prompt, onSubmit, placeholder, isActive = true } = props
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useInput(
    (input, key) => {
      if (submitted) return

      if (key.return) {
        setSubmitted(true)
        onSubmit(value)
      } else if (key.backspace || key.delete) {
        setValue((previous) => previous.slice(0, -1))
      } else if (!key.ctrl && !key.meta && input) {
        setValue((previous) => previous + input)
      }
    },
    { isActive: isActive && !submitted },
  )

  return (
    <Box>
      <Text>
        {prompt}
        {submitted ? (
          <Text color="green">{value}</Text>
        ) : (
          <Text>
            {value}
            <Text color="gray">█</Text>
            {!value && placeholder}
          </Text>
        )}
      </Text>
    </Box>
  )
}
