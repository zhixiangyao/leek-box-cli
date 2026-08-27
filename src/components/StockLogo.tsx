import Text from './Text.tsx'

const STOCK_LOGOS = new Map<string, string>([
  ['sh', '沪'],
  ['sz', '深'],
  ['bj', '北'],
])

type Props = {
  code: string
  bright?: boolean
}

export default function StockLogo({ code, bright = false }: Props) {
  const prefix = code.slice(0, 2).toLowerCase()
  const label = STOCK_LOGOS.get(prefix)

  if (!label) return undefined

  return (
    <Text bright={bright} color="white" backgroundColor="red">
      {label}
    </Text>
  )
}
