/** 可路由的命令页面 */
export type Screen = 'dashboard' | 'add-stock' | 'remove-stock'

/**
 * 页面元数据: 边框标题 (BorderTitle) + 状态栏按键提示 (StatusBar) 的唯一来源.
 * 新增子命令时: 扩展 Screen 联合类型并在此注册一条, 再同步 cli.tsx 的 COMMANDS,
 * app.tsx 的 screenComponentMap, MenuDialog 的 MENU_ITEMS.
 */
export const SCREEN_META: Record<Screen, { title: string; hint: string }> = {
  ['dashboard']: { title: '股票自选股看板', hint: '菜单(esc)   刷新(r)   间隔(-/+)   退出(q)' },
  ['add-stock']: { title: '添加自选股', hint: '菜单(esc)   退出(q)' },
  ['remove-stock']: { title: '删除自选股', hint: '菜单(esc)   退出(q)' },
}
