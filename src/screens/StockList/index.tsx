import { Box } from 'ink'

import QuoteRow from '../../components/QuoteRow.tsx'
import Text from '../../components/Text.tsx'
import { headerRow, missingRow, quoteRow } from '../../lib/columns.ts'
import { STOCK_LIST_COLUMNS } from '../../lib/stockTable.ts'
import { useStockListStore } from '../../stores/useStockListStore.ts'
import { useStockListPage } from './hooks/useStockList.ts'

export default function StockList() {
  const step = useStockListStore((state) => state.step)
  const selectedCode = useStockListStore((state) => state.selectedCode)
  const { window, rowsRef } = useStockListPage()

  if (step.type === 'loading') return <Text color="cyan">正在获取行情数据...</Text>
  if (step.type === 'empty') return <Text color="yellow">自选股为空, 按 esc 打开菜单添加自选股.</Text>

  if (step.type === 'error') {
    return (
      <>
        <Text color="red">{step.message}</Text>
        <Text color="gray">行情接口异常, 稍后自动重试</Text>
      </>
    )
  }

  return (
    <>
      <QuoteRow segments={headerRow(STOCK_LIST_COLUMNS)} />

      <Box ref={rowsRef} flexDirection="column" flexGrow={1} overflow="hidden">
        {step.rows.slice(window.start, window.end).map((row) => (
          <QuoteRow
            key={row.code}
            segments={
              row.kind === 'quote'
                ? quoteRow(STOCK_LIST_COLUMNS, row.quote)
                : missingRow(STOCK_LIST_COLUMNS, row.code, row.name)
            }
            selected={row.code === selectedCode}
          />
        ))}
      </Box>

      {step.errorLine ? <Text color="yellow">刷新失败: {step.errorLine}, 稍后自动重试</Text> : null}
    </>
  )
}
