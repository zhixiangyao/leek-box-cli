import type { ComponentType } from 'react'

import AddStock from '../screens/AddStock/index.tsx'
import RemoveStock from '../screens/RemoveStock/index.tsx'
import StockList from '../screens/StockList/index.tsx'

type ScreenDefinition = {
  component: ComponentType
  title: string
  description: string
  hint: string
  menuLabel: string
}

export const SCREEN_REGISTRY = {
  ['stock-list']: {
    component: StockList,
    title: '股票自选股看板',
    description: '股票自选股看板 (默认, 自动刷新)',
    hint: '菜单(esc)   刷新(r)   选择(↑/↓)   详情(enter)   间隔(-/+)   退出(q)',
    menuLabel: '股票自选股看板',
  },
  ['add-stock']: {
    component: AddStock,
    title: '添加自选股',
    description: '添加自选股',
    hint: '菜单(esc)   退出(q)',
    menuLabel: '添加自选股',
  },
  ['remove-stock']: {
    component: RemoveStock,
    title: '删除自选股',
    description: '删除自选股',
    hint: '菜单(esc)   退出(q)',
    menuLabel: '删除自选股',
  },
} as const satisfies Record<string, ScreenDefinition>

export type Screen = keyof typeof SCREEN_REGISTRY

export const SCREEN_LIST = Object.keys(SCREEN_REGISTRY) as Screen[]

export const isScreen = (value: string | undefined): value is Screen =>
  value !== undefined && Object.hasOwn(SCREEN_REGISTRY, value)

export const toScreen = (value: string | undefined): Screen => (isScreen(value) ? value : 'stock-list')
