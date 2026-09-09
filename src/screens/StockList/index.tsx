import { type ReactNode } from 'react'

import Card from '../../components/Card.tsx'
import QuoteRow from '../../components/QuoteRow.tsx'
import ScrollBox from '../../components/ScrollBox.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import { useOverlayOpen } from '../../hooks/useOverlayOpen.ts'
import { useTheme } from '../../hooks/useTheme.ts'
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
  const trendColorMode = useSettingsStore((state) => state.trendColorMode)
  const stockList = useStockList()
  let content: ReactNode

  switch (stockList.step.type) {
    case 'loading': {
      content = <Text color="cyan">正在获取行情数据...</Text>
      break
    }

    case 'empty': {
      content = <Text color="yellow">自选股为空, 按 esc 打开菜单添加自选股.</Text>
      break
    }

    case 'error': {
      content = (
        <>
          <Text color="red">{stockList.step.message}</Text>
          <Text color="gray">行情接口异常, 稍后自动重试</Text>
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
            <Text color="yellow">刷新失败: {stockList.step.errorLine}, 稍后自动重试</Text>
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
          <Text>还有 {stockList.remainingCount} 个</Text>
        ) : undefined
      }
    >
      {content}
    </Card>
  )
}
