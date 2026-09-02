import { Box } from 'ink'
import { type ReactNode } from 'react'

import Card from '../../components/Card.tsx'
import QuoteRow from '../../components/QuoteRow.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import { useOverlayOpen } from '../../hooks/useOverlayOpen.ts'
import { useTheme } from '../../hooks/useTheme.ts'
import { headerRow, missingRow, quoteRow, STOCK_LIST_COLUMNS } from '../../lib/quoteTable.ts'
import { useSettingsStore } from '../../stores/useSettingsStore.ts'
import { useStockList } from './hooks/useStockList.ts'

type Props = {
  title: string
  hint: string
}

export default function StockList({ title, hint }: Props) {
  const { overlayOpen } = useOverlayOpen()
  const theme = useTheme()
  const trendColorMode = useSettingsStore((state) => state.trendColorMode)
  const { rowsRef, step, selectedCode, window } = useStockList()
  let content: ReactNode

  switch (step.type) {
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
          <Text color="red">{step.message}</Text>
          <Text color="gray">行情接口异常, 稍后自动重试</Text>
        </>
      )
      break
    }

    case 'table': {
      content = (
        <>
          <QuoteRow segments={headerRow(STOCK_LIST_COLUMNS)} />

          <Box ref={rowsRef} flexDirection="column" flexGrow={1} overflow="hidden">
            {step.rows.slice(window.start, window.end).map((row) => (
              <QuoteRow
                key={row.code}
                segments={
                  row.kind === 'quote'
                    ? quoteRow(STOCK_LIST_COLUMNS, row.quote, trendColorMode)
                    : missingRow(STOCK_LIST_COLUMNS, row.code, row.name)
                }
                selected={row.code === selectedCode}
              />
            ))}
          </Box>

          {step.errorLine ? <Text color="yellow">刷新失败: {step.errorLine}, 稍后自动重试</Text> : undefined}
        </>
      )
      break
    }
  }

  return (
    <Card
      fullScreen
      bright={!overlayOpen}
      title={<Text color={theme.primary}>{title}</Text>}
      footer={<StatusBar showClock hint={hint} bright={!overlayOpen} />}
    >
      {content}
    </Card>
  )
}
