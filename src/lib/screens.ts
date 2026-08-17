export type Screen = 'dashboard' | 'add-stock' | 'remove-stock'

export const SCREEN_META = {
  ['dashboard']: { title: '股票自选股看板', hint: '菜单(esc)   刷新(r)   间隔(-/+)   退出(q)' },
  ['add-stock']: { title: '添加自选股', hint: '菜单(esc)   退出(q)' },
  ['remove-stock']: { title: '删除自选股', hint: '菜单(esc)   退出(q)' },
} satisfies Record<Screen, { title: string; hint: string }>

export const SCREEN_LIST = ['dashboard', 'add-stock', 'remove-stock'] as const satisfies readonly Screen[]

export const isScreen = (str: string | undefined): str is Screen =>
  str && SCREEN_LIST.includes(str as Screen) ? true : false

export const toScreen = (str: string | undefined): Screen => (isScreen(str) ? str : 'dashboard')
