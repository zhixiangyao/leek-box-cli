/**
 * 滚动窗口 [start, end): 窗口起点由 scrollOffset 决定 (越界钳制), 不与选中行绑定.
 * 否则窗口保持原位 (从末尾往上选时视图不变, 选中行先走完整个窗口).
 */
export const visibleWindow = (total: number, scrollOffset: number, visible: number): { start: number; end: number } => {
  if (total <= visible) return { start: 0, end: total }
  const maxStart = total - visible
  const start = Math.min(Math.max(scrollOffset, 0), maxStart)
  return { start, end: start + visible }
}
