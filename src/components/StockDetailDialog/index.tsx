import { Box } from 'ink'

import { headerRow, missingRow, quoteRow } from '../../lib/columns.ts'
import { formatPercent, formatPrice, formatSigned, trendColor } from '../../lib/format.ts'
import Dialog from '../Dialog.tsx'
import IntradayChart from '../IntradayChart/index.tsx'
import QuoteRow from '../QuoteRow.tsx'
import Text from '../Text.tsx'
import { useStockDetailDialog } from './hooks/useStockDetailDialog.ts'
import { CONTENT_WIDTH, DETAIL_COLUMNS, STOCK_DETAIL_WIDTH } from './lib.ts'

export default function StockDetailDialog() {
  const stockDetailDialog = useStockDetailDialog()
  if (!stockDetailDialog) return null
  const { stock, quote, suspended, status, points, errorMessage } = stockDetailDialog

  return (
    <Dialog
      title={
        <Text bright>
          <Text bright>{stock.name}</Text>
          <Text> </Text>
          <Text bright color="gray">
            {stock.code}
          </Text>
          <Text> </Text>
          <Text bright color={!quote || suspended ? 'gray' : trendColor(quote.change)}>
            {quote ? formatPrice(quote.current) : '--'}
          </Text>
          <Text> </Text>
          <Text bright color={!quote || suspended ? 'gray' : trendColor(quote.changePercent)}>
            {quote ? (suspended ? '停牌' : formatPercent(quote.changePercent)) : '--'}
          </Text>
          <Text> </Text>
          <Text bright color={!quote || suspended ? 'gray' : trendColor(quote.change)}>
            {quote ? formatSigned(quote.change) : '--'}
          </Text>
        </Text>
      }
      width={STOCK_DETAIL_WIDTH}
    >
      <Box flexDirection="column">
        <QuoteRow bright segments={headerRow(DETAIL_COLUMNS)} />
        <QuoteRow
          bright
          segments={quote ? quoteRow(DETAIL_COLUMNS, quote) : missingRow(DETAIL_COLUMNS, stock.code, stock.name)}
        />
      </Box>

      <Box marginTop={1}>
        {status === 'loading' ? (
          <Text bright color="gray">
            正在获取分时数据...
          </Text>
        ) : status === 'error' ? (
          <Text bright color="red">
            {errorMessage}
          </Text>
        ) : points.length === 0 ? (
          <Text bright color="gray">
            暂无分时数据 (非交易时段)
          </Text>
        ) : (
          <IntradayChart bright points={points} prevClose={quote?.prevClose ?? null} width={CONTENT_WIDTH} />
        )}
      </Box>
    </Dialog>
  )
}
