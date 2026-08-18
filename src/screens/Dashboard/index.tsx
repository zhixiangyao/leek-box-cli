import { useWindowSize } from 'ink'

import Text from '../../components/Text.tsx'
import { useDashboardStore } from '../../stores/useDashboardStore.ts'
import { useDashboardPage } from './hooks/useDashboard.ts'
import { headerRow, missingRow, quoteRow, tableSlices, type Row } from './lib/table.ts'

function StockRow(props: { segments: Row; selected: boolean }) {
  const { segments, selected } = props

  return (
    <Text inverse={selected}>
      {segments.map((segment, index) => (
        <Text key={index} color={segment.color}>
          {segment.text}
        </Text>
      ))}
    </Text>
  )
}

export default function Dashboard() {
  const dashboardStore = useDashboardStore()
  const { rows } = useWindowSize()

  useDashboardPage()

  if (dashboardStore.step.type === 'loading') {
    return <Text color="cyan">正在获取行情数据...</Text>
  }

  if (dashboardStore.step.type === 'empty') {
    return <Text color="yellow">自选股为空, 按 esc 打开菜单添加自选股.</Text>
  }

  if (dashboardStore.step.type === 'error') {
    return (
      <>
        <Text color="red">{dashboardStore.step.message}</Text>
        <Text color="gray">行情接口异常, 稍后自动重试</Text>
      </>
    )
  }

  const { quotes, missing, errorLine } = dashboardStore.step
  const { selectedIndex } = dashboardStore
  const { quoteStart, quoteEnd, missingStart, missingEnd } = tableSlices(
    rows,
    errorLine,
    quotes.length,
    missing.length,
    selectedIndex,
  )

  return (
    <>
      {/* 表头固定在顶部, 不参与滚动 */}
      <Text color="gray">
        {headerRow()
          .map(({ text }) => text)
          .join('')}
      </Text>

      {quotes.slice(quoteStart, quoteEnd).map((quote, index) => (
        <StockRow key={quote.code} segments={quoteRow(quote)} selected={quoteStart + index === selectedIndex} />
      ))}
      {missing.slice(missingStart, missingEnd).map((entry, index) => (
        <StockRow
          key={entry.code}
          segments={missingRow(entry.code, entry.name)}
          selected={quotes.length + missingStart + index === selectedIndex}
        />
      ))}

      {errorLine ? <Text color="yellow">刷新失败: {errorLine}, 稍后自动重试</Text> : null}
    </>
  )
}
