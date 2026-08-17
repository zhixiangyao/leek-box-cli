import { useState } from 'react'

/** 管理输入校验失败时的错误提示与输入框重置状态 */
export function useValidatedInput() {
  const [inputError, setInputError] = useState<string | null>(null)
  const [inputKey, setInputKey] = useState(0)

  /** 输入不合法: 显示错误并重置输入框 */
  const reject = (message: string) => {
    setInputError(message)
    setInputKey((key) => key + 1)
  }

  /**
   * 输入合法: 清除错误提示.
   * 同时递增 key, 强制下一步骤的输入框重新挂载 —
   * 否则 React 会复用上一步骤 TextInput 的实例 (相同位置/类型/key),
   * 使新输入框继承 submitted=true 和旧值, 从而无法继续输入.
   */
  const accept = () => {
    setInputError(null)
    setInputKey((key) => key + 1)
  }

  return { inputError, inputKey, reject, accept }
}
