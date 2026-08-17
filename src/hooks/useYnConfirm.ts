import { useValidatedInput } from './useValidatedInput.ts'

type Props = {
  onConfirm: () => void
  onCancel: () => void
}

/** y/n 确认输入: 校验答案, 合法则回调 onConfirm / onCancel, 否则提示错误并重置输入框 */
export function useYnConfirm({ onConfirm, onCancel }: Props) {
  const { inputError, inputKey, reject, accept } = useValidatedInput()

  const handleAnswer = (answer: string) => {
    const trimmed = answer.trim()
    if (trimmed !== 'y' && trimmed !== 'Y' && trimmed !== 'n' && trimmed !== 'N') {
      reject('错误: 必须选择 y (是) 或 n (否).')
      return
    }
    accept()
    if (/^[Yy]$/.test(trimmed)) {
      onConfirm()
    } else {
      onCancel()
    }
  }

  return { inputError, inputKey, handleAnswer }
}
