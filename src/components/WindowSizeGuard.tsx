import { Box, useWindowSize } from 'ink'
import type { ReactNode } from 'react'

import { useTranslation } from '../hooks/useTranslation.ts'
import { LOCALES } from '../i18n/locale.ts'
import { stockListColumns, tableWidth } from '../lib/quoteTable.ts'
import Text from './Text.tsx'

/** 看板水平 chrome: 边框 2 + 内容 padding 2 */
export const TABLE_CHROME = 4

/** 完整看板所需的最小终端高度 */
export const MIN_TERMINAL_ROWS = 26

/** 完整看板所需的最小终端宽度: 最宽 locale 的看板表格 + chrome, 取全部 locale 的最大值 */
export const MIN_TERMINAL_COLUMNS =
  Math.max(...LOCALES.map((locale) => tableWidth(stockListColumns(locale)))) + TABLE_CHROME

type Props = {
  children: ReactNode
}

export default function WindowSizeGuard({ children }: Props) {
  const { columns, rows } = useWindowSize()
  const { t } = useTranslation()
  const widthOk = columns >= MIN_TERMINAL_COLUMNS
  const heightOk = rows >= MIN_TERMINAL_ROWS

  if (widthOk && heightOk) return children

  return (
    <Box width={columns} height={rows} flexDirection="column" alignItems="center" justifyContent="center">
      <Text color="yellow">{t('windowGuard.tooSmall')}</Text>
      <Box>
        <Text color={widthOk ? 'green' : 'red'}>{t('windowGuard.width', { value: columns })}</Text>
        <Text> </Text>
        <Text color={heightOk ? 'green' : 'red'}>{t('windowGuard.height', { value: rows })}</Text>
      </Box>
      <Box height={1} />
      <Text color="gray">{t('windowGuard.required')}</Text>
      <Text color="gray">
        {t('windowGuard.requiredSize', { width: MIN_TERMINAL_COLUMNS, height: MIN_TERMINAL_ROWS })}
      </Text>
    </Box>
  )
}
