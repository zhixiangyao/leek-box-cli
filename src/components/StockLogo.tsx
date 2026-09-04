import Text from './Text.tsx'

const STOCK_LOGOS = new Map<string, string>([
  ['sh', '沪'],
  ['sz', '深'],
  ['bj', '北'],
])

type Props = {
  /** 默认为 false */
  bright?: boolean
  code: string | undefined
}

export default function StockLogo({ bright = false, code }: Props) {
  const prefix = code?.slice(0, 2).toLowerCase()
  const label = prefix ? STOCK_LOGOS.get(prefix) : undefined

  return (
    <Text bright={bright} color="white" backgroundColor="red">
      {label ?? '■'}
    </Text>
  )
}
