import type { Locale, Message } from '../types.ts'
import { en } from './en.ts'
import { zhHans } from './zh-hans.ts'
import { zhHant } from './zh-hant.ts'

export const CATALOGS = {
  'zh-hans': zhHans,
  'zh-hant': zhHant,
  en: en,
} as const satisfies Record<Locale, Message>
