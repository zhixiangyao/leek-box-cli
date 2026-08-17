/** y/n 确认输入解析: 合法返回 'y' | 'n', 否则返回 null (add-stock / remove-stock 共用) */
export function parseYn(answer: string): 'y' | 'n' | null {
  const trimmed = answer.trim()
  if (trimmed === 'y' || trimmed === 'Y') return 'y'
  if (trimmed === 'n' || trimmed === 'N') return 'n'
  return null
}

export const YN_ERROR_MESSAGE = '错误: 必须选择 y (是) 或 n (否).'
