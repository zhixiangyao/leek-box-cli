type Align = 'left' | 'right'

type Column = { title: string; width: number; align?: Align }

/** CJK 字符按宽度 2 计算的显示宽度 (不引入 string-width 依赖) */
export const displayWidth = (value: string) =>
  [...value].reduce((width, ch) => width + (ch.codePointAt(0)! > 0x2e80 ? 2 : 1), 0)

export const cell = (text: string, column: Column) =>
  column.align === 'right'
    ? ' '.repeat(Math.max(0, column.width - displayWidth(text))) + text
    : text + ' '.repeat(Math.max(0, column.width - displayWidth(text)))

export const COLUMNS = [
  { title: '代码', width: 10 },
  { title: '名称', width: 10 },
  { title: '现价', width: 8, align: 'right' },
  { title: '涨跌幅', width: 9, align: 'right' },
  { title: '涨跌额', width: 8, align: 'right' },
  { title: '今开', width: 8, align: 'right' },
  { title: '昨收', width: 8, align: 'right' },
  { title: '最高', width: 8, align: 'right' },
  { title: '最低', width: 8, align: 'right' },
] as const satisfies readonly Column[]
