import type { ComponentType } from 'react'

import AddStock from '../screens/AddStock/index.tsx'
import RemoveStock from '../screens/RemoveStock/index.tsx'
import Settings from '../screens/Settings/index.tsx'
import StockList from '../screens/StockList/index.tsx'

type ScreenComponentProps = { title: string; hint: string }

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
    title: '股票自选股看板',
    description: '股票自选股看板 (默认, 自动刷新)',
    hint: '菜单(esc)   刷新(r)   选择(↑/↓)   详情(enter)   间隔(-/+)   退出(q)',
    menuLabel: '股票自选股看板',
  },
  ['add-stock']: {
    Component: AddStock,
    title: '添加自选股',
    description: '添加自选股',
    hint: '菜单(esc)   退出(q)',
    menuLabel: '添加自选股',
  },
  ['remove-stock']: {
    Component: RemoveStock,
    title: '删除自选股',
    description: '删除自选股',
    hint: '菜单(esc)   退出(q)',
    menuLabel: '删除自选股',
  },
  settings: {
    Component: Settings,
    title: '设置',
    description: '配置主题与请求参数',
    hint: '菜单(esc)   选择(↑/↓)   调整(←/→/enter)   默认值(d)   退出(q)',
    menuLabel: '设置',
  },
} as const satisfies Record<string, ScreenDefinition>

export type Screen = keyof typeof SCREEN_REGISTRY

export const SCREEN_LIST = Object.keys(SCREEN_REGISTRY) as Screen[]

export const isScreen = (value: string | undefined): value is Screen =>
  value !== undefined && Object.hasOwn(SCREEN_REGISTRY, value)

export const toScreen = (value: string | undefined): Screen => (isScreen(value) ? value : 'stock-list')
