import Text from '../../components/Text.tsx'
import { useDashboardStore } from '../../stores/useDashboardStore.ts'
import { useDashboardPage } from './hooks/useDashboard.ts'
import { cell, COLUMNS, formatPercent, formatPrice, formatSigned, trendColor } from './lib/table.ts'

export default function Dashboard() {
  const step = useDashboardStore((state) => state.step)

  useDashboardPage()

  if (step.type === 'loading') {
    return <Text color="cyan">正在获取行情数据...</Text>
  }

  if (step.type === 'empty') {
    return <Text color="yellow">自选股为空, 按 esc 打开菜单添加自选股.</Text>
  }

  if (step.type === 'error') {
    // 轮询会自动重试, 无需操作
    return (
      <>
        <Text color="red">{step.message}</Text>
        <Text color="gray">行情接口异常, 稍后自动重试</Text>
      </>
    )
  }

  return (
    <>
      <Text color="gray">{COLUMNS.map((col) => cell(col.title, col.width, col.align)).join('')}</Text>

      {step.quotes.map((quote) => {
        const suspended = quote.current <= 0
        return (
          <Text key={quote.code}>
            <Text color="gray">
              {cell(quote.code, COLUMNS[0]!.width, COLUMNS[0]!.align)}
              {cell(quote.name, COLUMNS[1]!.width, COLUMNS[1]!.align)}
            </Text>
            {suspended ? (
              <>
                <Text color="gray">
                  {cell('--', COLUMNS[2]!.width, COLUMNS[2]!.align)}
                  {cell('停牌', COLUMNS[3]!.width, COLUMNS[3]!.align)}
                </Text>
                <Text color="gray">
                  {cell('--', COLUMNS[4]!.width, COLUMNS[4]!.align)}
                  {cell('--', COLUMNS[5]!.width, COLUMNS[5]!.align)}
                  {cell('--', COLUMNS[6]!.width, COLUMNS[6]!.align)}
                  {cell('--', COLUMNS[7]!.width, COLUMNS[7]!.align)}
                  {cell('--', COLUMNS[8]!.width, COLUMNS[8]!.align)}
                </Text>
              </>
            ) : (
              <>
                <Text color={trendColor(quote.change)}>
                  {cell(formatPrice(quote.current), COLUMNS[2]!.width, COLUMNS[2]!.align)}
                </Text>
                <Text color={trendColor(quote.changePercent)}>
                  {cell(formatPercent(quote.changePercent), COLUMNS[3]!.width, COLUMNS[3]!.align)}
                </Text>
                <Text color={trendColor(quote.change)}>
                  {cell(formatSigned(quote.change), COLUMNS[4]!.width, COLUMNS[4]!.align)}
                </Text>
                <Text color="gray">{cell(formatPrice(quote.open), COLUMNS[5]!.width, COLUMNS[5]!.align)}</Text>
                <Text color="gray">{cell(formatPrice(quote.prevClose), COLUMNS[6]!.width, COLUMNS[6]!.align)}</Text>
                <Text color="gray">{cell(formatPrice(quote.high), COLUMNS[7]!.width, COLUMNS[7]!.align)}</Text>
                <Text color="gray">{cell(formatPrice(quote.low), COLUMNS[8]!.width, COLUMNS[8]!.align)}</Text>
              </>
            )}
          </Text>
        )
      })}

      {step.missing.map((entry) => (
        <Text key={entry.code}>
          <Text color="gray">
            {cell(entry.code, COLUMNS[0]!.width)}
            {cell(entry.name, COLUMNS[1]!.width)}
            {cell('--', COLUMNS[2]!.width, COLUMNS[2]!.align)}
            {cell('无数据', COLUMNS[3]!.width, COLUMNS[3]!.align)}
            {cell('--', COLUMNS[4]!.width, COLUMNS[4]!.align)}
            {cell('--', COLUMNS[5]!.width, COLUMNS[5]!.align)}
            {cell('--', COLUMNS[6]!.width, COLUMNS[6]!.align)}
            {cell('--', COLUMNS[7]!.width, COLUMNS[7]!.align)}
            {cell('--', COLUMNS[8]!.width, COLUMNS[8]!.align)}
          </Text>
        </Text>
      ))}

      {step.errorLine ? <Text color="yellow">刷新失败: {step.errorLine}, 稍后自动重试</Text> : null}
    </>
  )
}
