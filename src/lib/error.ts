/** 把任意异常转为可展示的文本 (Error 取 message, 其余直接 String) */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
