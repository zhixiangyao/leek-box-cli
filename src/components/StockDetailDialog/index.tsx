import { Box } from 'ink'

import { headerRow, missingRow, quoteRow } from '../../lib/columns.ts'
import { formatPercent, formatPrice, formatSigned, trendColor } from '../../lib/format.ts'
import { DIALOG_CHROME } from '../../lib/layout.ts'
import { STOCK_DETAIL_COLUMNS, stockDetailColumnsWidth } from '../../lib/stockTable.ts'
import { useSettingsStore } from '../../stores/useSettingsStore.ts'
import Dialog from '../Dialog.tsx'
import QuoteRow from '../QuoteRow.tsx'
import StockChart, { STOCK_CHART_HEIGHT } from '../StockChart/index.tsx'
import StockLogo from '../StockLogo.tsx'
import Text from '../Text.tsx'
import { CHART_PERIOD_OPTIONS, useStockDetailDialog } from './hooks/useStockDetailDialog.ts'

/** 弹窗宽度 = 详情表格总宽 + DIALOG_CHROME + 冗余 4 */
const STOCK_DETAIL_WIDTH = stockDetailColumnsWidth() + DIALOG_CHROME + 6
const CONTENT_WIDTH = STOCK_DETAIL_WIDTH - DIALOG_CHROME

export default function StockDetailDialog() {
  const trendColorMode = useSettingsStore((state) => state.trendColorMode)
  const stockDetailDialog = useStockDetailDialog()

  if (!stockDetailDialog) return undefined

  const { stock, quote, suspended, period, status, points, errorMessage } = stockDetailDialog
  const periodLabel = CHART_PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? ''

  return (
    <Dialog
      title={
        <Text bright>
          <StockLogo code={stock.code} bright />
          <Text> </Text>
          <Text bright>{stock.name}</Text>
          <Text> </Text>
          <Text bright color="gray">
            {stock.code}
          </Text>
          <Text> </Text>
          <Text bright color={!quote || suspended ? 'gray' : trendColor(quote.change, trendColorMode)}>
            {quote ? formatPrice(quote.current) : '--'}
          </Text>
          <Text> </Text>
          <Text bright color={!quote || suspended ? 'gray' : trendColor(quote.changePercent, trendColorMode)}>
            {quote ? (suspended ? '停牌' : formatPercent(quote.changePercent)) : '--'}
          </Text>
          <Text> </Text>
          <Text bright color={!quote || suspended ? 'gray' : trendColor(quote.change, trendColorMode)}>
            {quote ? formatSigned(quote.change) : '--'}
          </Text>
        </Text>
      }
      extra={
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
        <QuoteRow bright segments={headerRow(STOCK_DETAIL_COLUMNS)} />
        <QuoteRow
          bright
          segments={
            quote
              ? quoteRow(STOCK_DETAIL_COLUMNS, quote, trendColorMode)
              : missingRow(STOCK_DETAIL_COLUMNS, stock.code, stock.name)
          }
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
            prevClose={quote?.prevClose}
            trendColorMode={trendColorMode}
            width={CONTENT_WIDTH}
          />
        )}
      </Box>
    </Dialog>
  )
}
