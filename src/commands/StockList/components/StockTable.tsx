import QuoteRow from '../../../components/QuoteRow.tsx'
import ScrollBox, { type ScrollBoxProps } from '../../../components/ScrollBox.tsx'
import { type Column, headerRow, missingRow, quoteRow } from '../../../lib/quoteTable.ts'
import { useSettingsStore } from '../../../stores/useSettingsStore.ts'
import { type StockListRow } from '../../../stores/useStockListStore.ts'

type Props = {
  columns: Column[]
  scrollOffset: number
  list: StockListRow[]
  selectedCode: StockListRow['code'] | undefined
  onVisibleChange: ScrollBoxProps<StockListRow>['onVisibleChange']
}

export default function StockTable(props: Props) {
  const { columns, scrollOffset, list, selectedCode, onVisibleChange } = props
  const trendColorMode = useSettingsStore((state) => state.trendColorMode)

  return (
    <>
      <QuoteRow segments={headerRow(columns)} />

      <ScrollBox
        list={list}
        scrollOffset={scrollOffset}
        customRender={(item) => (
          <QuoteRow
            key={item.code}
            segments={
              item.kind === 'quote' ? quoteRow(columns, item.quote, trendColorMode) : missingRow(columns, item.code)
            }
            selected={item.code === selectedCode}
          />
        )}
        onVisibleChange={onVisibleChange}
      />
    </>
  )
}
