import { Fragment, type ReactNode } from 'react'

import Card from '../../components/Card.tsx'
import MarketIndexTicker from '../../components/MarketIndexTicker/index.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import { useOverlayOpen } from '../../hooks/useOverlayOpen.ts'
import { useTheme } from '../../hooks/useTheme.ts'
import { useTranslation } from '../../hooks/useTranslation.ts'
import type { MessageKey } from '../../i18n/types.ts'
import StockTable from './components/StockTable.tsx'
import { useStockList } from './hooks/useStockList.ts'
import type { StockListSortMode } from './lib.ts'

const SORT_LABEL_KEYS: Record<StockListSortMode, MessageKey | undefined> = {
  default: undefined,
  desc: 'stockList.sort.desc',
  asc: 'stockList.sort.asc',
}

export default function StockList() {
  const overlayOpen = useOverlayOpen()
  const theme = useTheme()
  const { t } = useTranslation()
  const stockList = useStockList()
  const topRightSegments: { text: string; color?: string }[] = [
    { text: t('stockList.refreshInterval', { value: stockList.pollIntervalMs }) },
  ]
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
      const list = stockList.rows
      const sortLabelKey = SORT_LABEL_KEYS[stockList.sortMode]
      if (sortLabelKey !== undefined) {
        topRightSegments.unshift({ text: t(sortLabelKey), color: 'cyan' })
      }
      content = (
        <>
          <StockTable
            columns={stockList.scaledColumns}
            scrollOffset={stockList.scrollOffset}
            list={list}
            selectedCode={stockList.selectedCode}
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
      borderTopCenter={<MarketIndexTicker indices={stockList.indices} />}
      borderTopRight={
        <Text>
          {topRightSegments.map((segment, index) => (
            <Fragment key={segment.text}>
              {index > 0 && <Text> | </Text>}
              <Text color={segment.color}>{segment.text}</Text>
            </Fragment>
          ))}
        </Text>
      }
      footer={<StatusBar showClock hint={t('command.stockList.hint')} bright={!overlayOpen.open} />}
    >
      {content}
    </Card>
  )
}
