import { randomUUID } from 'node:crypto'
import { link, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'

const LOCK_RETRY_MS = 25
const LOCK_TIMEOUT_MS = 2000
const LOCK_STALE_MS = 30_000

/** 等待指定毫秒数 */
const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs))

/** 判断指定进程是否仍在运行 */
const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

/** 尝试清理过期的文件锁 */
const tryRemoveStaleLock = async (lockPath: string): Promise<boolean> => {
  let contents: string
  try {
    contents = await readFile(lockPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
    throw error
  }

  let stale = false
  try {
    const metadata = JSON.parse(contents) as unknown
    if (
      !isNormalObject(metadata) ||
      typeof metadata['token'] !== 'string' ||
      typeof metadata['pid'] !== 'number' ||
      !Number.isInteger(metadata['pid']) ||
      metadata['pid'] <= 0 ||
      typeof metadata['createdAt'] !== 'number' ||
      !Number.isFinite(metadata['createdAt'])
    ) {
      throw new Error('lock metadata 无效')
    }
    stale = !isProcessAlive(metadata['pid']) || Date.now() - metadata['createdAt'] >= LOCK_STALE_MS
  } catch {
    try {
      const lockStat = await stat(lockPath)
      stale = Date.now() - lockStat.mtimeMs >= LOCK_TIMEOUT_MS
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
      throw error
    }
  }
  if (!stale) return false

  try {
    if ((await readFile(lockPath, 'utf8')) !== contents) return false
    await rm(lockPath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
    throw error
  }
}

const isNormalObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 发布新的跨进程文件锁 */
const publishLock = async (lockPath: string, contents: string) => {
  const temporaryPath = `${lockPath}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' })
    await link(temporaryPath, lockPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

/**
 * 在目标文件旁的文件锁保护下执行异步操作.
 * lockPath = filePath + '.lock', 元数据先写入临时文件, 再通过 hard link 原子发布.
 */
export async function withFileLock<Result>(filePath: string, operation: () => Promise<Result>): Promise<Result> {
  const lockPath = `${filePath}.lock`
  const lockToken = randomUUID()
  const lockContents = JSON.stringify({ token: lockToken, pid: process.pid, createdAt: Date.now() })
  await mkdir(dirname(filePath), { recursive: true })
  const startedAt = Date.now()
  let acquired = false

  while (!acquired) {
    try {
      await publishLock(lockPath, lockContents)
      acquired = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (await tryRemoveStaleLock(lockPath)) continue
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error('文件正被其他进程占用, 请稍后重试')
      }
      await sleep(LOCK_RETRY_MS)
    }
  }

  let outcome: { ok: true; value: Result } | { ok: false; error: unknown }
  try {
    outcome = { ok: true, value: await operation() }
  } catch (error) {
    outcome = { ok: false, error }
  }

  let cleanupError: unknown
  try {
    if ((await readFile(lockPath, 'utf8')) === lockContents) await rm(lockPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') cleanupError = error
  }

  if (!outcome.ok) throw outcome.error
  if (cleanupError) throw cleanupError
  return outcome.value
}
