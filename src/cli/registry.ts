import type { ComponentType } from 'react'

import type { MessageKey } from '../i18n/types.ts'
import Settings from '../screens/Settings/index.tsx'
import StockAdd from '../screens/StockAdd/index.tsx'
import StockList from '../screens/StockList/index.tsx'
import StockRemove from '../screens/StockRemove/index.tsx'

export type Screen = 'stock-list' | 'stock-add' | 'stock-remove' | 'settings'

/** App 用 t() 解析注册表文案后再传入, 页面只接收已翻译的字符串 */
type ScreenComponentProps = { title: string; hint: string }

type ScreenDefinition = {
  Component: ComponentType<ScreenComponentProps>
  title: MessageKey
  description: MessageKey
  hint: MessageKey
  menuLabel: MessageKey
}

export const SCREEN_REGISTRY = {
  ['stock-list']: {
    Component: StockList,
    title: 'screen.stockList.title',
    description: 'screen.stockList.description',
    hint: 'screen.stockList.hint',
    menuLabel: 'screen.stockList.menuLabel',
  },
  ['stock-add']: {
    Component: StockAdd,
    title: 'screen.stockAdd.title',
    description: 'screen.stockAdd.description',
    hint: 'screen.stockAdd.hint',
    menuLabel: 'screen.stockAdd.menuLabel',
  },
  ['stock-remove']: {
    Component: StockRemove,
    title: 'screen.stockRemove.title',
    description: 'screen.stockRemove.description',
    hint: 'screen.stockRemove.hint',
    menuLabel: 'screen.stockRemove.menuLabel',
  },
  ['settings']: {
    Component: Settings,
    title: 'screen.settings.title',
    description: 'screen.settings.description',
    hint: 'screen.settings.hint',
    menuLabel: 'screen.settings.menuLabel',
  },
} satisfies Record<Screen, ScreenDefinition>

export const SCREEN_LIST = Object.keys(SCREEN_REGISTRY) as Screen[]

export const SCREEN_REGISTRY_ENTRIES = SCREEN_LIST.map<[Screen, ScreenDefinition]>((screen) => [
  screen,
  SCREEN_REGISTRY[screen],
])

export const isScreen = (value: string | undefined): value is Screen => !!value && SCREEN_LIST.includes(value as Screen)

export const toScreen = (value: string | undefined): Screen => (isScreen(value) ? value : 'stock-list')
