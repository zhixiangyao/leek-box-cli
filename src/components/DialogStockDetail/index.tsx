import { Box, useWindowSize } from 'ink'
import stringWidth from 'string-width'

import { useTranslation } from '../../hooks/useTranslation.ts'
import { EMPTY_VALUE, formatPercent, formatPrice, formatSigned, trendColor } from '../../lib/format.ts'
import { headerRow, missingRow, quoteRow, stockDetailColumns, tableWidth } from '../../lib/quoteTable.ts'
import { useSettingsStore } from '../../stores/useSettingsStore.ts'
import Dialog, { DIALOG_CHROME, DIALOG_WIDTH_RESERVE } from '../Dialog.tsx'
import QuoteRow from '../QuoteRow.tsx'
import StockChart, { STOCK_CHART_HEIGHT } from '../StockChart/index.tsx'
import StockLogo from '../StockLogo.tsx'
import Text from '../Text.tsx'
import { CHART_PERIOD_OPTIONS, useDialogStockDetail } from './hooks/useDialogStockDetail.ts'

export default function DialogStockDetail() {
  const { columns } = useWindowSize()
  const { locale, t } = useTranslation()
  const trendColorMode = useSettingsStore((state) => state.trendColorMode)
  const { stock, quote, suspended, period, status, points, detailError } = useDialogStockDetail()
  const columnsForLocale = stockDetailColumns(locale)
  const periodOption = CHART_PERIOD_OPTIONS.find((option) => option.value === period)
  const periodLabel = periodOption ? t(periodOption.labelKey) : undefined
  const hint = t('dialogStockDetail.hint')
  const widest = Math.max(tableWidth(columnsForLocale), stringWidth(hint))
  const width = Math.min(Math.max(columns - 2, 1), widest + DIALOG_CHROME + DIALOG_WIDTH_RESERVE)
  const stockChartWidth = width - DIALOG_CHROME

  return (
    <Dialog
      title={
        <Text bright>
          <StockLogo code={stock?.code} bright />
          <Text> </Text>
          <Text bright>{stock?.name ?? EMPTY_VALUE}</Text>
          <Text> </Text>
          <Text bright color="gray">
            {stock?.code ?? EMPTY_VALUE}
          </Text>
          <Text> </Text>
          <Text bright color={!quote || suspended ? 'gray' : trendColor(quote.change, trendColorMode)}>
            {quote ? formatPrice(quote.current) : EMPTY_VALUE}
          </Text>
          <Text> </Text>
          <Text bright color={!quote || suspended ? 'gray' : trendColor(quote.changePercent, trendColorMode)}>
            {quote ? (suspended ? t('common.suspended') : formatPercent(quote.changePercent)) : EMPTY_VALUE}
          </Text>
          <Text> </Text>
          <Text bright color={!quote || suspended ? 'gray' : trendColor(quote.change, trendColorMode)}>
            {quote ? formatSigned(quote.change) : EMPTY_VALUE}
          </Text>
        </Text>
      }
      extra={
        <Text bright>
          {CHART_PERIOD_OPTIONS.map((option, index) => (
            <Text key={option.value} bright color={option.value === period ? 'cyan' : 'gray'}>
              {index > 0 ? ' ' : ''}[{option.key}]{t(option.labelKey)}
            </Text>
          ))}
        </Text>
      }
      width={width}
      hint={hint}
    >
      <Box flexDirection="column">
        <QuoteRow bright segments={headerRow(columnsForLocale)} />
        <QuoteRow
          bright
          segments={
            quote
              ? quoteRow(columnsForLocale, quote, trendColorMode)
              : missingRow(columnsForLocale, stock?.code ?? EMPTY_VALUE, stock?.name ?? EMPTY_VALUE)
          }
        />
      </Box>

      <Box marginTop={1} height={STOCK_CHART_HEIGHT}>
        {status === 'loading' ? (
          <Text bright color="gray">
            {t('dialogStockDetail.loading', { period: periodLabel ?? '' })}
          </Text>
        ) : status === 'error' ? (
          <Text bright color="red">
            {detailError}
          </Text>
        ) : points.length === 0 ? (
          <Text bright color="gray">
            {t('dialogStockDetail.empty', { period: periodLabel ?? '' })}
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
