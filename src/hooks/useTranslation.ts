import { useMemo } from 'react'

import { createTranslator } from '../i18n/core.ts'
import { resolveLanguage } from '../i18n/locale.ts'
import type { Translate, Locale } from '../i18n/types.ts'
import { useSettingsStore } from '../stores/useSettingsStore.ts'

/** 读取当前语言下的翻译函数与 locale */
export function useTranslation(): { locale: Locale; t: Translate } {
  const language = useSettingsStore((state) => state.language)
  const locale = useMemo(() => resolveLanguage(language), [language])
  const t = useMemo(() => createTranslator(locale), [locale])

  return { locale, t }
}
