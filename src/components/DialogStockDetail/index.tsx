import { Box, useWindowSize } from 'ink'
import stringWidth from 'string-width'

import { formatPercent, formatPrice, formatSigned, trendColor } from '../../lib/format.ts'
import { headerRow, missingRow, quoteRow, STOCK_DETAIL_COLUMNS, tableWidth } from '../../lib/quoteTable.ts'
import { useSettingsStore } from '../../stores/useSettingsStore.ts'
import Dialog, { DIALOG_CHROME, DIALOG_WIDTH_RESERVE } from '../Dialog.tsx'
import QuoteRow from '../QuoteRow.tsx'
import StockChart, { STOCK_CHART_HEIGHT } from '../StockChart/index.tsx'
import StockLogo from '../StockLogo.tsx'
import Text from '../Text.tsx'
import { CHART_PERIOD_OPTIONS, useDialogStockDetail } from './hooks/useDialogStockDetail.ts'

/** 提示 */
const HINT = '关闭(esc)   切换(1-6)'

export default function DialogStockDetail() {
  const { columns } = useWindowSize()
  const trendColorMode = useSettingsStore((state) => state.trendColorMode)
  const { stock, quote, suspended, period, status, points, detailError } = useDialogStockDetail()
  const periodLabel = CHART_PERIOD_OPTIONS.find((option) => option.value === period)?.label
  const hint = HINT
  const widest = Math.max(tableWidth(STOCK_DETAIL_COLUMNS), stringWidth(hint))
  const width = Math.min(Math.max(columns - 2, 1), widest + DIALOG_CHROME + DIALOG_WIDTH_RESERVE)
  const stockChartWidth = width - DIALOG_CHROME

  return (
    <Dialog
      title={
        <Text bright>
          <StockLogo code={stock?.code} bright />
          <Text> </Text>
          <Text bright>{stock?.name ?? '--'}</Text>
          <Text> </Text>
          <Text bright color="gray">
            {stock?.code ?? '--'}
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
      width={width}
      hint={hint}
    >
      <Box flexDirection="column">
        <QuoteRow bright segments={headerRow(STOCK_DETAIL_COLUMNS)} />
        <QuoteRow
          bright
          segments={
            quote
              ? quoteRow(STOCK_DETAIL_COLUMNS, quote, trendColorMode)
              : missingRow(STOCK_DETAIL_COLUMNS, stock?.code ?? '--', stock?.name ?? '--')
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
            {detailError}
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
            width={stockChartWidth}
          />
        )}
      </Box>
    </Dialog>
  )
}
