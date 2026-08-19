import { Box, useInput } from 'ink'
import { type JSX, useState } from 'react'

import { useMenuStore } from '../stores/useMenuStore.ts'
import Text from './Text.tsx'

type Props = {
  prompt: string
  onSubmit: (value: string) => void
  placeholder?: JSX.Element | JSX.Element[]
}

export default function TextInput(props: Props) {
  const { prompt, onSubmit, placeholder } = props
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const menuStore = useMenuStore()

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
    { isActive: !menuStore.open && !submitted },
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
            {value || !placeholder ? null : placeholder}
          </Text>
        )}
      </Text>
    </Box>
  )
}
