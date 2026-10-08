import type { Key } from 'ink'

export type CursorDirection = 'left' | 'right' | 'up' | 'down'

/** 只取四个方向键标志位: ink 的 Key 结构兼容, 测试里也只需构造这四个字段 */
export type ArrowFlags = Pick<Key, 'upArrow' | 'downArrow' | 'leftArrow' | 'rightArrow'>

/** vim 键到方向的映射: hint 里展示的 hjkl 就是这个集合 */
const VIM_DIRECTIONS: Record<string, CursorDirection> = { h: 'left', j: 'down', k: 'up', l: 'right' }

/** 方向键或 vim 键对应的方向, 其余按键返回 undefined */
export function keyDirection(input: string, key: ArrowFlags): CursorDirection | undefined {
  if (key.leftArrow) return 'left'
  if (key.rightArrow) return 'right'
  if (key.upArrow) return 'up'
  if (key.downArrow) return 'down'
  return VIM_DIRECTIONS[input]
}
