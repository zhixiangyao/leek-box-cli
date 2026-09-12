import { t } from '../i18n/core.ts'

export function parseYesNo(answer: string): 'y' | 'n' | undefined {
  const trimmed = answer.trim()
  if (['y', 'Y'].includes(trimmed)) return 'y'
  if (['n', 'N'].includes(trimmed)) return 'n'
  return undefined
}

/** 延迟到调用时取文案, 保证跟随当前界面语言 */
export const yesNoErrorMessage = (): string => t('common.yesNoError')
