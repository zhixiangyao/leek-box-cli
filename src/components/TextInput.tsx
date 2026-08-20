import { Box, useInput } from 'ink'
import { type ReactNode, useEffect, useState } from 'react'

import { useOverlayOpen } from '../hooks/useOverlayOpen.ts'
import Text from './Text.tsx'

type Props = {
  prompt: string
  onSubmit: (value: string) => void
  placeholder?: ReactNode
  resetToken?: string | number
}

export default function TextInput({ prompt, onSubmit, placeholder, resetToken }: Props) {
  const overlayOpen = useOverlayOpen()
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setValue('')
    setSubmitted(false)
  }, [resetToken])

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
    { isActive: !overlayOpen && !submitted },
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
