import Text from '../../components/Text.tsx'
import { formatPercent, formatPrice, formatSigned, trendColor } from '../../lib/format.ts'
import { useDashboardStore } from '../../stores/useDashboardStore.ts'
import { useDashboardPage } from './hooks/useDashboard.ts'
import { cell, COLUMNS } from './lib/table.ts'

export default function Dashboard() {
  const dashboardStore = useDashboardStore()

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

  return (
    <>
      <Text color="gray">{COLUMNS.map((col) => cell(col.title, col)).join('')}</Text>

      {dashboardStore.step.quotes.map((quote) => {
        const suspended = quote.current <= 0
        return (
          <Text key={quote.code}>
            <Text color="gray">
              {cell(quote.code, COLUMNS[0])}
              {cell(quote.name, COLUMNS[1])}
            </Text>
            {suspended ? (
              <>
                <Text color="gray">
                  {cell('--', COLUMNS[2])}
                  {cell('停牌', COLUMNS[3])}
                </Text>
                <Text color="gray">
                  {cell('--', COLUMNS[4])}
                  {cell('--', COLUMNS[5])}
                  {cell('--', COLUMNS[6])}
                  {cell('--', COLUMNS[7])}
                  {cell('--', COLUMNS[8])}
                </Text>
              </>
            ) : (
              <>
                <Text color={trendColor(quote.change)}>{cell(formatPrice(quote.current), COLUMNS[2])}</Text>
                <Text color={trendColor(quote.changePercent)}>
                  {cell(formatPercent(quote.changePercent), COLUMNS[3])}
                </Text>
                <Text color={trendColor(quote.change)}>{cell(formatSigned(quote.change), COLUMNS[4])}</Text>
                <Text color="gray">{cell(formatPrice(quote.open), COLUMNS[5])}</Text>
                <Text color="gray">{cell(formatPrice(quote.prevClose), COLUMNS[6])}</Text>
                <Text color="gray">{cell(formatPrice(quote.high), COLUMNS[7])}</Text>
                <Text color="gray">{cell(formatPrice(quote.low), COLUMNS[8])}</Text>
              </>
            )}
          </Text>
        )
      })}

      {dashboardStore.step.missing.map((entry) => (
        <Text key={entry.code}>
          <Text color="gray">
            {cell(entry.code, COLUMNS[0])}
            {cell(entry.name, COLUMNS[1])}
            {cell('--', COLUMNS[2])}
            {cell('无数据', COLUMNS[3])}
            {cell('--', COLUMNS[4])}
            {cell('--', COLUMNS[5])}
            {cell('--', COLUMNS[6])}
            {cell('--', COLUMNS[7])}
            {cell('--', COLUMNS[8])}
          </Text>
        </Text>
      ))}

      {dashboardStore.step.errorLine ? (
        <Text color="yellow">刷新失败: {dashboardStore.step.errorLine}, 稍后自动重试</Text>
      ) : null}
    </>
  )
}
