import { type ReactNode } from 'react'

import Card from '../../components/Card.tsx'
import CheckboxGrid from '../../components/CheckboxGrid/index.tsx'
import StatusBar from '../../components/StatusBar.tsx'
import Text from '../../components/Text.tsx'
import { useOverlayOpen } from '../../hooks/useOverlayOpen.ts'
import { useTheme } from '../../hooks/useTheme.ts'
import { useTranslation } from '../../hooks/useTranslation.ts'
import type { StockEntry } from '../../settings/schema.ts'
import { useStockRemove } from './hooks/useStockRemove.ts'

type Props = {
  title: string
  hint: string
}

export default function StockRemove({ title, hint }: Props) {
  const overlayOpen = useOverlayOpen()
  const theme = useTheme()
  const { t } = useTranslation()
  const { entries, errorMessage, resetToken, open } = useStockRemove()
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
      <CheckboxGrid<StockEntry>
        key={resetToken}
        items={entries}
        getKey={(entry) => entry.code}
        getLabel={(entry) => entry.name}
        getHint={(entry) => entry.code}
        isActive={!overlayOpen.open}
        onSubmit={open}
      />
    )
  }

  return (
    <Card
      fullScreen
      bright={!overlayOpen.open}
      title={<Text color={theme.primary}>{title}</Text>}
      footer={<StatusBar showClock hint={hint} bright={!overlayOpen.open} />}
    >
      {content}
    </Card>
  )
}
