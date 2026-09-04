export function parseYesNo(answer: string): 'y' | 'n' | undefined {
  const trimmed = answer.trim()
  if (['y', 'Y'].includes(trimmed)) return 'y'
  if (['n', 'N'].includes(trimmed)) return 'n'
  return undefined
}

export const YES_NO_ERROR_MESSAGE = '错误: 必须选择 y (是) 或 n (否).'
