import { t } from '../i18n/core.ts'

export function parseYesNo(answer: string): 'y' | 'n' | undefined {
  const trimmed = answer.trim()
  if (['y', 'Y'].includes(trimmed)) return 'y'
  if (['n', 'N'].includes(trimmed)) return 'n'
  return undefined
}

/** y/n 校验失败的提示文案 */
export const yesNoErrorMessage = (): string => t('common.yesNoError')
