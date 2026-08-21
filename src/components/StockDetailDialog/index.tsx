import { Box } from 'ink'

import { headerRow, missingRow, quoteRow } from '../../lib/columns.ts'
import { formatPercent, formatPrice, formatSigned, trendColor } from '../../lib/format.ts'
import Dialog from '../Dialog.tsx'
import QuoteRow from '../QuoteRow.tsx'
import StockChart, { STOCK_CHART_HEIGHT } from '../StockChart/index.tsx'
import Text from '../Text.tsx'
import { CHART_PERIOD_OPTIONS, useStockDetailDialog } from './hooks/useStockDetailDialog.ts'
import { CONTENT_WIDTH, DETAIL_COLUMNS, STOCK_DETAIL_WIDTH } from './lib.ts'

export default function StockDetailDialog() {
  const stockDetailDialog = useStockDetailDialog()
  if (!stockDetailDialog) return null
  const { stock, quote, suspended, period, status, points, errorMessage } = stockDetailDialog
  const periodLabel = CHART_PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? ''

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
      rightTitle={
        <Text bright>
          {CHART_PERIOD_OPTIONS.map((option, index) => (
            <Text key={option.value} bright color={option.value === period ? 'cyan' : 'gray'}>
              {index > 0 ? ' ' : ''}[{option.key}]{option.label}
            </Text>
          ))}
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

      <Box marginTop={1} height={STOCK_CHART_HEIGHT}>
        {status === 'loading' ? (
          <Text bright color="gray">
            正在获取{periodLabel}行情...
          </Text>
        ) : status === 'error' ? (
          <Text bright color="red">
            {errorMessage}
          </Text>
        ) : points.length === 0 ? (
          <Text bright color="gray">
            暂无{periodLabel}行情数据
          </Text>
        ) : (
          <StockChart
            bright
            points={points}
            period={period}
            prevClose={quote?.prevClose ?? null}
            width={CONTENT_WIDTH}
          />
        )}
      </Box>
    </Dialog>
  )
}
