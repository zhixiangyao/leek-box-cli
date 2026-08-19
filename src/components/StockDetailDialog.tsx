import { Box, Text } from 'ink'

import {
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatRate,
  formatRatio,
  formatTurnover,
  formatVolume,
  trendColor,
} from '../lib/format.ts'
import { useDashboardStore } from '../stores/useDashboardStore.ts'
import { useStockDetailStore } from '../stores/useStockDetailStore.ts'
import Dialog, { DIALOG_CHROME } from './Dialog.tsx'
import IntradayChart from './IntradayChart/index.tsx'

const STOCK_DETAIL_WIDTH = 72
const CONTENT_WIDTH = STOCK_DETAIL_WIDTH - DIALOG_CHROME

export default function StockDetailDialog() {
  const detailStore = useStockDetailStore()
  const quote = useDashboardStore((state) =>
    state.step.type === 'table' ? state.step.quotes.find((q) => q.code === detailStore.code) : undefined,
  )
  const suspended = !quote || quote.current <= 0
  const trend = suspended ? 'gray' : trendColor(quote.change)

  return (
    <Dialog
      title={
        <Text>
          <Text>{detailStore.name}</Text>
          <Text color="gray"> {detailStore.code}</Text>
          <Text> </Text>
          <Text color={trend}>
            {quote ? formatPrice(quote.current) : '--'} {quote ? formatPercent(quote.changePercent) : ''}
          </Text>
        </Text>
      }
      width={STOCK_DETAIL_WIDTH}
    >
      <Box marginBottom={1}>
        <Box flexDirection="column" marginRight={1}>
          <Text color="gray" backgroundColor="magenta">
            今开
          </Text>
          <Text color="gray">{formatPrice(quote?.open ?? 0)}</Text>
        </Box>
        <Box flexDirection="column" marginRight={1}>
          <Text color="gray" backgroundColor="magenta">
            昨收
          </Text>
          <Text color="gray">{formatPrice(quote?.prevClose ?? 0)}</Text>
        </Box>
        <Box flexDirection="column" marginRight={1}>
          <Text color="gray" backgroundColor="magenta">
            最高
          </Text>
          <Text color="gray">{formatPrice(quote?.high ?? 0)}</Text>
        </Box>
        <Box flexDirection="column" marginRight={1}>
          <Text color="gray" backgroundColor="magenta">
            最低
          </Text>
          <Text color="gray">{formatPrice(quote?.low ?? 0)}</Text>
        </Box>
        <Box flexDirection="column" marginRight={1}>
          <Text color="gray" backgroundColor="magenta">
            成交量
          </Text>
          <Text color="gray">{formatVolume(quote?.volume ?? 0)}</Text>
        </Box>
        <Box flexDirection="column" marginRight={1}>
          <Text color="gray" backgroundColor="magenta">
            成交额
          </Text>
          <Text color="gray">{formatTurnover(quote?.turnover ?? 0)}</Text>
        </Box>
        <Box flexDirection="column" marginRight={1}>
          <Text color="gray" backgroundColor="magenta">
            换手率
          </Text>
          <Text color="gray">{formatRate(quote?.turnoverRate ?? 0)}</Text>
        </Box>
        <Box flexDirection="column" marginRight={1}>
          <Text color="gray" backgroundColor="magenta">
            振幅
          </Text>
          <Text color="gray">{formatRate(quote?.amplitude ?? 0)}</Text>
        </Box>
        <Box flexDirection="column" marginRight={1}>
          <Text color="gray" backgroundColor="magenta">
            量比
          </Text>
          <Text color="gray">{formatRatio(quote?.volumeRatio ?? 0)}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" backgroundColor="magenta">
            总市值
          </Text>
          <Text color="gray">{formatMarketCap(quote?.marketCap ?? 0)}</Text>
        </Box>
      </Box>

      {detailStore.status === 'loading' ? (
        <Text color="gray">正在获取分时数据...</Text>
      ) : detailStore.status === 'error' ? (
        <Text color="red">{detailStore.errorMessage}</Text>
      ) : detailStore.points.length === 0 ? (
        <Text color="gray">暂无分时数据 (非交易时段)</Text>
      ) : (
        <IntradayChart points={detailStore.points} prevClose={quote?.prevClose ?? null} width={CONTENT_WIDTH} />
      )}
    </Dialog>
  )
}
