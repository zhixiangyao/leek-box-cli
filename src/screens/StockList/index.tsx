import { type ReactNode } from 'react'

import Card from '../../components/Card.tsx'
import QuoteRow from '../../components/QuoteRow.tsx'
import ScrollBox from '../../components/ScrollBox.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import { useOverlayOpen } from '../../hooks/useOverlayOpen.ts'
import { useTheme } from '../../hooks/useTheme.ts'
import { useTranslation } from '../../hooks/useTranslation.ts'
import { headerRow, missingRow, quoteRow } from '../../lib/quoteTable.ts'
import { useSettingsStore } from '../../stores/useSettingsStore.ts'
import { useStockList } from './hooks/useStockList.ts'

type Props = {
  title: string
  hint: string
}

export default function StockList({ title, hint }: Props) {
  const overlayOpen = useOverlayOpen()
  const theme = useTheme()
  const { t } = useTranslation()
  const trendColorMode = useSettingsStore((state) => state.trendColorMode)
  const stockList = useStockList()
  let content: ReactNode

  switch (stockList.step.type) {
    case 'loading': {
      content = <Text color="cyan">{t('stockList.loading')}</Text>
      break
    }

    case 'empty': {
      content = <Text color="yellow">{t('common.watchlistEmpty')}</Text>
      break
    }

    case 'error': {
      content = (
        <>
          <Text color="red">{stockList.step.message}</Text>
          <Text color="gray">{t('stockList.sourceError')}</Text>
        </>
      )
      break
    }

    case 'table': {
      const rows = stockList.step.rows
      content = (
        <>
          <QuoteRow segments={headerRow(stockList.scaledColumns)} />

          <ScrollBox
            list={rows}
            scrollOffset={stockList.scrollOffset}
            customRender={(row) => (
              <QuoteRow
                key={row.code}
                segments={
                  row.kind === 'quote'
                    ? quoteRow(stockList.scaledColumns, row.quote, trendColorMode)
                    : missingRow(stockList.scaledColumns, row.code, row.name)
                }
                selected={row.code === stockList.selectedCode}
              />
            )}
            onWindowChange={({ end }) => stockList.handlesWindowChange(rows.length - end)}
            onVisibleChange={stockList.handlesVisibleChange}
          />

          {stockList.step.errorLine ? (
            <Text color="yellow">{t('stockList.refreshFailed', { error: stockList.step.errorLine })}</Text>
          ) : undefined}
        </>
      )
      break
    }
  }

  return (
    <Card
      fullScreen
      bright={!overlayOpen.open}
      title={<Text color={theme.primary}>{title}</Text>}
      footer={<StatusBar showClock hint={hint} bright={!overlayOpen.open} />}
      extra={
        stockList.step.type === 'table' && stockList.remainingCount > 0 ? (
          <Text>{t('stockList.remaining', { count: stockList.remainingCount })}</Text>
        ) : undefined
      }
    >
      {content}
    </Card>
  )
}
