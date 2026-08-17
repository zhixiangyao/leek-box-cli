import { Box, BoxProps, Text, useInput } from 'ink'
import { ReactNode, useState } from 'react'

type Props = {
  prompt: string
  onSubmit: (value: string) => void
  /** 外部禁用输入 (如菜单弹窗打开时), 默认 true */
  isActive?: boolean
  /** 占位符 */
  placeholder?: string | ReactNode
} & BoxProps

export default function TextInput(props: Props) {
  const { prompt, onSubmit, isActive = true, placeholder, ...boxProps } = props
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

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
    { isActive: isActive && !submitted },
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
