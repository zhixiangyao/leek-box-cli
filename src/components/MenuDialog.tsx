import { Box, Text, useApp, useInput, useWindowSize } from 'ink'
import { useState } from 'react'

import type { Screen } from '../stores/router.ts'

type Props = {
  onSelect: (screen: Screen) => void
}

const MENU_ITEMS: { label: string; screen: Screen | null }[] = [
  { label: '1) 股票涨跌看板', screen: 'dashboard' },
  { label: '2) 添加自选股', screen: 'add-stock' },
  { label: '3) 删除自选股', screen: 'remove-stock' },
  { label: '4) 退出程序', screen: null },
]

// 含 '> ' 前缀最长项 18 宽, 内容区 = 总宽 - 边框 2 - padding 2, 留足余量
const MENU_WIDTH = 30
// 4 项 = 4 行内容, 再加 paddingY 2 + 边框 2
const MENU_HEIGHT = MENU_ITEMS.length + 4

/**
 * 菜单浮层弹窗: 绝对定位居中覆盖在当前页之上,
 * 上下方向键移动高亮 + enter 确认, 数字键快捷选择, esc 由 App 层负责开关.
 */
export default function MenuDialog({ onSelect }: Props) {
  const [highlight, setHighlight] = useState(0)
  const { rows, columns } = useWindowSize()
  const { exit } = useApp()

  useInput((input, key) => {
    if (key.upArrow) {
      setHighlight((prev) => (prev + MENU_ITEMS.length - 1) % MENU_ITEMS.length)
    } else if (key.downArrow) {
      setHighlight((prev) => (prev + 1) % MENU_ITEMS.length)
    } else if (key.return) {
      choose(MENU_ITEMS[highlight]!)
    } else if (/^[1-4]$/.test(input)) {
      const index = Number(input) - 1
      setHighlight(index)
      choose(MENU_ITEMS[index]!)
    }
  })

  const choose = (item: (typeof MENU_ITEMS)[number]) => {
    if (item.screen) {
      onSelect(item.screen)
    } else {
      exit()
    }
  }

  const top = Math.max(0, Math.floor((rows - MENU_HEIGHT) / 2))
  const left = Math.max(0, Math.floor((columns - MENU_WIDTH) / 2))

  return (
    <Box
      position="absolute"
      top={top}
      left={left}
      width={MENU_WIDTH}
      height={MENU_HEIGHT}
      borderStyle="classic"
      flexDirection="column"
      paddingX={1}
      paddingY={1}
    >
      {MENU_ITEMS.map((item, index) => (
        <Text
          key={item.label}
          color={index === highlight ? 'black' : undefined}
          backgroundColor={index === highlight ? 'cyan' : undefined}
        >
          {index === highlight ? '> ' : '  '}
          {item.label}
        </Text>
      ))}
    </Box>
  )
}
