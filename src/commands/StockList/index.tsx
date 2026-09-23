import { type ReactNode } from 'react'

import Card from '../../components/Card.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import { useOverlayOpen } from '../../hooks/useOverlayOpen.ts'
import { useTheme } from '../../hooks/useTheme.ts'
import { useTranslation } from '../../hooks/useTranslation.ts'
import StockTable from './components/StockTable.tsx'
import { useStockList } from './hooks/useStockList.ts'

export default function StockList() {
  const overlayOpen = useOverlayOpen()
  const theme = useTheme()
  const { t } = useTranslation()
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
      const list = stockList.step.rows
      content = (
        <>
          <StockTable
            columns={stockList.scaledColumns}
            scrollOffset={stockList.scrollOffset}
            list={list}
            selectedCode={stockList.selectedCode}
            onWindowChange={({ end }) => stockList.handlesWindowChange(list.length - end)}
            onVisibleChange={stockList.handlesVisibleChange}
          />

          {!!stockList.step.errorLine && (
            <Text color="yellow">{t('stockList.refreshFailed', { error: stockList.step.errorLine })}</Text>
          )}
        </>
      )
      break
    }
  }

  return (
    <Card
      full
      bright={!overlayOpen.open}
      borderTopLeft={<Text color={theme.primary}>{t('command.stockList.title')}</Text>}
      borderTopRight={
        stockList.step.type === 'table' && stockList.remainingCount > 0 ? (
          <Text>{t('stockList.remaining', { count: stockList.remainingCount })}</Text>
        ) : undefined
      }
      footer={<StatusBar showClock hint={t('command.stockList.hint')} bright={!overlayOpen.open} />}
    >
      {content}
    </Card>
  )
}
