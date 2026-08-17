import { Text as InkText } from 'ink'
import type { ComponentProps } from 'react'

import { useRouterStore } from '../stores/useRouterStore.ts'

/**
 * 菜单弹窗打开时整页背景变暗的本地 Text 包装: 直接订阅 router store 的 menuOpen.
 * 所有会渲染在背景层 (页面内容 / StatusBar / 边框叠加层) 的文字
 * 都应 import 本文件而非 ink 的 Text; MenuDialog 直接用 ink 的 Text, 不受变暗影响.
 */
export default function Text(props: ComponentProps<typeof InkText>) {
  const menuOpen = useRouterStore((state) => state.menuOpen)
  // 显式传入的 dimColor 优先, 便于个别文字选择不变暗
  return <InkText {...props} dimColor={props.dimColor ?? menuOpen} />
}
