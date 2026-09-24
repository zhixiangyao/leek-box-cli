import { useWindowSize } from 'ink'
import { type ReactNode } from 'react'

import Card from '../../components/Card.tsx'
import CheckboxGrid from '../../components/CheckboxGrid/index.tsx'
import { gridColumnCount } from '../../components/CheckboxGrid/lib.ts'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import { TABLE_CHROME } from '../../components/WindowSizeGuard.tsx'
import { useOverlayOpen } from '../../hooks/useOverlayOpen.ts'
import { useTheme } from '../../hooks/useTheme.ts'
import { useTranslation } from '../../hooks/useTranslation.ts'
import type { StockRemoveEntry } from '../../stores/useStockRemoveStore.ts'
import { useStockRemove } from './hooks/useStockRemove.ts'

export default function StockRemove() {
  const { columns } = useWindowSize()

  const overlayOpen = useOverlayOpen()
  const theme = useTheme()
  const { t } = useTranslation()
  const { entries, errorMessage, resetToken, open } = useStockRemove()
  const columnGap = 2
  const columnCount = gridColumnCount(columns - TABLE_CHROME, columnGap)
  let content: ReactNode

  if (entries.length === 0) {
    content = errorMessage ? (
      <Text color="red">{errorMessage}</Text>
    ) : (
      <Text color="yellow">{t('common.watchlistEmpty')}</Text>
    )
  } else {
    // 网格常驻: 无浮层时可交互, 确认/删除阶段作为底层被弹窗覆盖并变暗.
    // key 绑定 resetToken: 取消或删除后网格重新挂载, 清空已勾选的股票.
    content = (
      <CheckboxGrid<StockRemoveEntry>
        key={resetToken}
        items={entries}
        getKey={(entry) => entry.code}
        getLabel={(entry) => entry.name ?? entry.code}
        getHint={(entry) => (entry.name === undefined ? undefined : entry.code)}
        columnCount={columnCount}
        columnGap={columnGap}
        isActive={!overlayOpen.open}
        onSubmit={open}
      />
    )
  }

  return (
    <Card
      full
      bright={!overlayOpen.open}
      borderTopLeft={<Text color={theme.primary}>{t('command.stockRemove.title')}</Text>}
      footer={<StatusBar showClock hint={t('command.stockRemove.hint')} bright={!overlayOpen.open} />}
    >
      {content}
    </Card>
  )
}
