/** 弹窗 chrome 宽: 边框 2 + paddingX 2 */
export const DIALOG_CHROME = 4

/** 完整看板所需的最小终端高度 */
export const MIN_TERMINAL_ROWS = 26

/** CJK 字符按宽度 2 计算的显示宽度 */
export const displayWidth = (value: string) =>
  [...value].reduce((width, ch) => width + (ch.codePointAt(0)! > 0x2e80 ? 2 : 1), 0)
