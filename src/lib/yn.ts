export function parseYn(answer: string): 'y' | 'n' | undefined {
  const trimmed = answer.trim()
  if (trimmed === 'y' || trimmed === 'Y') return 'y'
  if (trimmed === 'n' || trimmed === 'N') return 'n'
  return undefined
}

export const YN_ERROR_MESSAGE = '错误: 必须选择 y (是) 或 n (否).'
