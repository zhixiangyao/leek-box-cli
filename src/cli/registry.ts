import type { ComponentType } from 'react'

import Settings from '../screens/Settings/index.tsx'
import StockAdd from '../screens/StockAdd/index.tsx'
import StockList from '../screens/StockList/index.tsx'
import StockRemove from '../screens/StockRemove/index.tsx'

export type Screen = 'stock-list' | 'stock-add' | 'stock-remove' | 'settings'

type ScreenComponentProps = { title: ScreenDefinition['title']; hint: ScreenDefinition['hint'] }

type ScreenDefinition = {
  Component: ComponentType<ScreenComponentProps>
  title: string
  description: string
  hint: string
  menuLabel: string
}

export const SCREEN_REGISTRY = {
  ['stock-list']: {
    Component: StockList,
    title: '自选股票看板',
    description: '自选股票看板',
    hint: '菜单(esc)   刷新(r)   选择(↑/↓)   详情(enter)   退出(q)',
    menuLabel: '自选股票看板',
  },
  ['stock-add']: {
    Component: StockAdd,
    title: '添加自选股',
    description: '添加自选股',
    hint: '菜单(esc)   退出(q)',
    menuLabel: '添加自选股',
  },
  ['stock-remove']: {
    Component: StockRemove,
    title: '删除自选股',
    description: '删除自选股',
    hint: '菜单(esc)   移动(↑/↓/←/→)   选择(空格)   删除(enter)   退出(q)',
    menuLabel: '删除自选股',
  },
  ['settings']: {
    Component: Settings,
    title: '设置',
    description: '配置主题, 涨跌颜色与请求参数',
    hint: '菜单(esc)   选择(↑/↓)   调整(←/→/enter)   默认值(d)   退出(q)',
    menuLabel: '设置',
  },
} as const satisfies Record<Screen, ScreenDefinition>

export const SCREEN_LIST: Screen[] = ['stock-list', 'stock-add', 'stock-remove', 'settings']

export const isScreen = (value: string | undefined): value is Screen => !!value && SCREEN_LIST.includes(value as Screen)

export const toScreen = (value: string | undefined): Screen => (isScreen(value) ? value : 'stock-list')
