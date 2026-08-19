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
import Dialog from './Dialog.tsx'
import IntradayChart from './IntradayChart/index.tsx'

const DIALOG_WIDTH = 72
/** 边框 2 + paddingY 2 + 信息 2 + 图表 14 (9 折线 + 4 量柱 + 1 时间轴) */
const DIALOG_HEIGHT = 20
const CONTENT_WIDTH = DIALOG_WIDTH - 4

export default function StockDetailDialog() {
  const detailStore = useStockDetailStore()
  // 现价/涨跌幅等实时数据来自看板 5s 轮询 (打开详情必在看板页, 轮询必活跃, 零重复拉取)
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
      width={DIALOG_WIDTH}
      height={DIALOG_HEIGHT}
    >
      <Box>
        <Text color="gray">今开 {formatPrice(quote?.open ?? 0)}</Text>
        <Text color="gray">昨收 {formatPrice(quote?.prevClose ?? 0)}</Text>
        <Text color="gray">最高 {formatPrice(quote?.high ?? 0)}</Text>
        <Text color="gray">最低 {formatPrice(quote?.low ?? 0)}</Text>
        <Text color="gray">成交量 {formatVolume(quote?.volume ?? 0)}</Text>
        <Text color="gray">成交额 {formatTurnover(quote?.turnover ?? 0)}</Text>
        <Text color="gray">换手率 {formatRate(quote?.turnoverRate ?? 0)}</Text>
        <Text color="gray">振幅 {formatRate(quote?.amplitude ?? 0)}</Text>
        <Text color="gray">量比 {formatRatio(quote?.volumeRatio ?? 0)}</Text>
        <Text color="gray">总市值 {formatMarketCap(quote?.marketCap ?? 0)}</Text>
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
