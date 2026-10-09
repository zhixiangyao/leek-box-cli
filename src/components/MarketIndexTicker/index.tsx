import type { Quote } from '../../api/types.ts'
import QuoteRow from '../QuoteRow.tsx'
import { useMarketIndexTicker } from './hooks/useMarketIndexTicker.ts'

type Props = {
  indices: Quote[]
}

export default function MarketIndexTicker(props: Props) {
  const segments = useMarketIndexTicker(props.indices)

  if (segments.length === 0) return null
  return <QuoteRow segments={segments} />
}
