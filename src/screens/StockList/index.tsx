import { Box } from 'ink'

import QuoteRow from '../../components/QuoteRow.tsx'
import Text from '../../components/Text.tsx'
import { headerRow, missingRow, quoteRow } from '../../lib/columns.ts'
import { useStockListStore } from '../../stores/useStockListStore.ts'
import { useStockListPage } from './hooks/useStockList.ts'
import { STOCK_LIST_COLUMNS } from './lib.ts'

export default function StockList() {
  const stockListStore = useStockListStore()
  const { window, rowsRef } = useStockListPage()

  if (stockListStore.step.type === 'loading') {
    return <Text color="cyan">正在获取行情数据...</Text>
  }

  if (stockListStore.step.type === 'empty') {
    return <Text color="yellow">自选股为空, 按 esc 打开菜单添加自选股.</Text>
  }

  if (stockListStore.step.type === 'error') {
    return (
      <>
        <Text color="red">{stockListStore.step.message}</Text>
        <Text color="gray">行情接口异常, 稍后自动重试</Text>
      </>
    )
  }

  const { rows, errorLine } = stockListStore.step

  return (
    <>
      {/* 表头固定在顶部, 不参与滚动 */}
      <QuoteRow segments={headerRow(STOCK_LIST_COLUMNS)} />

      <Box ref={rowsRef} flexDirection="column" flexGrow={1} overflow="hidden">
        {rows.slice(window.start, window.end).map((row) => (
          <QuoteRow
            key={row.code}
            segments={
              row.kind === 'quote'
                ? quoteRow(STOCK_LIST_COLUMNS, row.quote)
                : missingRow(STOCK_LIST_COLUMNS, row.code, row.name)
            }
            selected={row.code === stockListStore.selectedCode}
          />
        ))}
      </Box>

      {errorLine ? <Text color="yellow">刷新失败: {errorLine}, 稍后自动重试</Text> : null}
    </>
  )
}
