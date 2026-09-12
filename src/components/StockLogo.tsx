import { useTranslation } from '../hooks/useTranslation.ts'
import type { MessageKey } from '../i18n/types.ts'
import Text from './Text.tsx'

const STOCK_LOGOS = new Map<string, MessageKey>([
  ['sh', 'stockLogo.sh'],
  ['sz', 'stockLogo.sz'],
  ['bj', 'stockLogo.bj'],
])

type Props = {
  /** 默认为 false */
  bright?: boolean
  code: string | undefined
}

export default function StockLogo({ bright = false, code }: Props) {
  const { t } = useTranslation()
  const prefix = code?.slice(0, 2).toLowerCase()
  const label = prefix ? STOCK_LOGOS.get(prefix) : undefined

  return (
    <Text bright={bright} color="white" backgroundColor="red">
      {label ? t(label) : '■'}
    </Text>
  )
}
