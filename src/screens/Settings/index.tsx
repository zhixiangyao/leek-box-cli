import { Box } from 'ink'

import Card from '../../components/Card.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import { useTheme } from '../../hooks/useTheme.ts'
import { useTranslation } from '../../hooks/useTranslation.ts'
import { type ThemePalette } from '../../settings/schema.ts'
import { type SettingRow, useSettings } from './hooks/useSettings.ts'

type Props = {
  title: string
  hint: string
}

function SettingRows({ rows, highlight }: { rows: SettingRow[]; highlight: ThemePalette['highlight'] }) {
  return rows.map((row) => (
    <Box key={row.label} justifyContent="space-between">
      <Text color={row.selected ? 'black' : undefined} backgroundColor={row.selected ? highlight : undefined}>
        {row.selected ? '› ' : '  '}
        {row.label}
        <Text color="gray" backgroundColor={row.selected ? highlight : undefined}>
          ({row.description})
        </Text>
      </Text>
      <Text color={row.selected ? highlight : 'gray'}>{row.value}</Text>
    </Box>
  ))
}

export default function Settings({ title, hint }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const { overlayOpen, appearanceRows, requestRows } = useSettings()

  return (
    <Card
      fullScreen
      bright={!overlayOpen.open}
      title={<Text color={theme.primary}>{title}</Text>}
      footer={<StatusBar showClock hint={hint} bright={!overlayOpen.open} />}
    >
      <Text color={theme.primary}>{t('settings.section.appearance')}</Text>
      <SettingRows rows={appearanceRows} highlight={theme.highlight} />

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.primary}>{t('settings.section.request')}</Text>
        <SettingRows rows={requestRows} highlight={theme.highlight} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="gray">{t('settings.note.minimumDuration')}</Text>
      </Box>
    </Card>
  )
}
