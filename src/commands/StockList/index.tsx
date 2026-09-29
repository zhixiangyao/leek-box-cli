import { type ReactNode } from 'react'

import Card from '../../components/Card.tsx'
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
  const topRightSegments: { text: string; color?: string }[] = []
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
        topRightSegments.push({ text: t(sortLabelKey), color: 'cyan' })
      }
      if (stockList.remainingCount !== undefined) {
        topRightSegments.push({ text: t('stockList.remaining', { count: stockList.remainingCount }) })
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
      borderTopRight={
        topRightSegments.length > 0 ? (
          <Text>
            {topRightSegments.map((segment, index) => (
              <Text key={segment.text} color={segment.color}>
                {index > 0 ? ' ' : ''}
                {segment.text}
              </Text>
            ))}
          </Text>
        ) : undefined
      }
      footer={<StatusBar showClock hint={t('command.stockList.hint')} bright={!overlayOpen.open} />}
    >
      {content}
    </Card>
  )
}
