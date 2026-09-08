import process from 'node:process'

export const isWindows = () => process.platform === 'win32'

/** 判断值是否为普通对象 */
export const isNormalObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 判断值是否为正数 (>0); 非正值(0/负数/NaN) 视为空 */
export const isPositive = (value: number): boolean => value > 0

/** 判断指定进程是否仍在运行 */
export const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}
