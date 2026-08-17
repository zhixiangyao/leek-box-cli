import { Box, Text } from 'ink'

import { useDashboardStore } from '../../stores/useDashboardStore.ts'
import { useDashboardPage } from './hooks/useDashboard.ts'
import { cell, COLUMNS, formatPercent, formatPrice, formatSigned, trendColor } from './lib/table.ts'

type Props = {
  /** 菜单弹窗打开时禁用刷新键 */
  isActive: boolean
}

export default function Dashboard({ isActive }: Props) {
  const step = useDashboardStore((state) => state.step)
  const pollIntervalMs = useDashboardStore((state) => state.pollIntervalMs)

  useDashboardPage(isActive)

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
      <Box width="100%" justifyContent="space-between" marginBottom={1}>
        <Text color="cyan">股票自选股看板</Text>
        <Text color="cyan">
          {step.updatedAt} ({pollIntervalMs}ms)
        </Text>
      </Box>

      <Text color="gray">{COLUMNS.map((col) => cell(col.title, col.width, col.align)).join('')}</Text>

      {step.quotes.map((quote) => {
        const suspended = quote.current <= 0
        return (
          <Text key={quote.code}>
            <Text color="gray">
              {cell(quote.code, COLUMNS[0]!.width)}
              {cell(quote.name, COLUMNS[1]!.width)}
            </Text>
            {suspended ? (
              <>
                <Text color="gray">
                  {cell('--', COLUMNS[2]!.width, 'right')}
                  {cell('停牌', COLUMNS[3]!.width, 'right')}
                </Text>
                <Text color="gray">
                  {cell('--', COLUMNS[4]!.width, 'right')}
                  {cell('--', COLUMNS[5]!.width, 'right')}
                  {cell('--', COLUMNS[6]!.width, 'right')}
                  {cell('--', COLUMNS[7]!.width, 'right')}
                  {cell('--', COLUMNS[8]!.width, 'right')}
                </Text>
              </>
            ) : (
              <>
                <Text color={trendColor(quote.change)}>
                  {cell(formatPrice(quote.current), COLUMNS[2]!.width, 'right')}
                </Text>
                <Text color={trendColor(quote.changePercent)}>
                  {cell(formatPercent(quote.changePercent), COLUMNS[3]!.width, 'right')}
                </Text>
                <Text color={trendColor(quote.change)}>
                  {cell(formatSigned(quote.change), COLUMNS[4]!.width, 'right')}
                </Text>
                <Text color="gray">{cell(formatPrice(quote.open), COLUMNS[5]!.width, 'right')}</Text>
                <Text color="gray">{cell(formatPrice(quote.prevClose), COLUMNS[6]!.width, 'right')}</Text>
                <Text color="gray">{cell(formatPrice(quote.high), COLUMNS[7]!.width, 'right')}</Text>
                <Text color="gray">{cell(formatPrice(quote.low), COLUMNS[8]!.width, 'right')}</Text>
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
            {cell('--', COLUMNS[2]!.width, 'right')}
            {cell('无数据', COLUMNS[3]!.width, 'right')}
            {cell('--', COLUMNS[4]!.width, 'right')}
            {cell('--', COLUMNS[5]!.width, 'right')}
            {cell('--', COLUMNS[6]!.width, 'right')}
            {cell('--', COLUMNS[7]!.width, 'right')}
            {cell('--', COLUMNS[8]!.width, 'right')}
          </Text>
        </Text>
      ))}

      {step.errorLine ? <Text color="yellow">刷新失败: {step.errorLine}, 稍后自动重试</Text> : null}
    </>
  )
}
