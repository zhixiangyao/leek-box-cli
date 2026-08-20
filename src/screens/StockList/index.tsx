import { Box } from 'ink'

import QuoteRow from '../../components/QuoteRow.tsx'
import Text from '../../components/Text.tsx'
import { headerRow, missingRow, quoteRow } from '../../lib/columns.ts'
import { useStockListStore } from '../../stores/useStockListStore.ts'
import { useStockListPage } from './hooks/useStockList.ts'
import { STOCK_LIST_COLUMNS } from './lib.ts'

export default function StockList() {
  const stockListStore = useStockListStore()
  const { slices, rowsRef } = useStockListPage()

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

  const { quotes, missing, errorLine } = stockListStore.step
  const { selectedIndex } = stockListStore

  return (
    <>
      {/* 表头固定在顶部, 不参与滚动 */}
      <QuoteRow segments={headerRow(STOCK_LIST_COLUMNS)} />

      <Box ref={rowsRef} flexDirection="column" flexGrow={1} overflow="hidden">
        {quotes.slice(slices.quoteStart, slices.quoteEnd).map((quote, index) => (
          <QuoteRow
            key={quote.code}
            segments={quoteRow(STOCK_LIST_COLUMNS, quote)}
            selected={slices.quoteStart + index === selectedIndex}
          />
        ))}
        {missing.slice(slices.missingStart, slices.missingEnd).map((entry, index) => (
          <QuoteRow
            key={entry.code}
            segments={missingRow(STOCK_LIST_COLUMNS, entry.code, entry.name)}
            selected={quotes.length + slices.missingStart + index === selectedIndex}
          />
        ))}
      </Box>

      {errorLine ? <Text color="yellow">刷新失败: {errorLine}, 稍后自动重试</Text> : null}
    </>
  )
}
