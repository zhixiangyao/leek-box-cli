import { Box } from 'ink'

import Card from '../../components/Card.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import { useTheme } from '../../hooks/useTheme.ts'
import { useSettings } from './hooks/useSettings.ts'

type Props = {
  title: string
  hint: string
}

type SettingRow = {
  label: string
  value: string
  selected: boolean
}

function SettingRows({ rows, highlight }: { rows: SettingRow[]; highlight: string }) {
  return rows.map((row) => (
    <Box key={row.label} justifyContent="space-between">
      <Text color={row.selected ? 'black' : undefined} backgroundColor={row.selected ? highlight : undefined}>
        {row.selected ? '› ' : '  '}
        {row.label}
      </Text>
      <Text color={row.selected ? highlight : 'gray'}>{row.value}</Text>
    </Box>
  ))
}

export default function Settings({ title, hint }: Props) {
  const theme = useTheme()
  const { overlayOpen, appearanceItems, requestItems } = useSettings()

  return (
    <Card
      fullScreen
      bright={!overlayOpen}
      title={<Text color={theme.primary}>{title}</Text>}
      footer={<StatusBar hint={hint} bright={!overlayOpen} />}
    >
      <Text color={theme.primary}>外观</Text>
      <SettingRows rows={appearanceItems} highlight={theme.highlight} />

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.primary}>请求与刷新</Text>
        <SettingRows rows={requestItems} highlight={theme.highlight} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="gray">↑/↓ 选择 ←/→ 或 Enter 调整 d 恢复默认值</Text>
        <Text color="gray">请求最短耗时用于避免加载状态闪烁, 且不会超过请求超时.</Text>
      </Box>
    </Card>
  )
}
