import { randomUUID } from 'node:crypto'
import { link, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'

import { t } from '../i18n/core.ts'
import { isNormalObject, isProcessAlive } from '../lib/is.ts'

const LOCK_RETRY_MS = 25
const LOCK_TIMEOUT_MS = 2000
const LOCK_STALE_MS = 30_000
/**
 * 元数据读不懂的锁最多占用调用方一半的等待预算.
 * 这类锁不可能是本程序留下的 (本程序的锁是整份元数据经 hard link 发布, 不存在写了一半的元数据),
 * 因此可以按残留清理; 但只按 mtime 判断会看错机器之间的时钟偏移: 文件时间戳与调用方 Date.now()
 * 同源于内核, 却不是同一个读数, 偏移在不同机器上可以是几十毫秒甚至更多. 偏移为正时 "mtime 过期"
 * 永远晚于 busy 超时, 调用方先报错, 清理也就永远不发生 (CI 上 mtime 比 startedAt 新约 20ms, 该用例稳定失败).
 * 另外留一半预算, 清理必定在本次调用报错前完成, 不依赖任何时间戳精度.
 */
const LOCK_UNREADABLE_GRACE_MS = LOCK_TIMEOUT_MS / 2

/** 等待指定毫秒数 */
const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs))

/** 尝试清理过期的文件锁, waitedMs 是调用方本次已经等待的毫秒数 */
const tryRemoveStaleLock = async (lockPath: string, waitedMs: number): Promise<boolean> => {
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
      throw new Error(t('settings.lock.invalidMetadata'))
    }
    stale = !isProcessAlive(metadata['pid']) || Date.now() - metadata['createdAt'] >= LOCK_STALE_MS
  } catch {
    try {
      const lockStat = await stat(lockPath)
      stale = Date.now() - lockStat.mtimeMs >= LOCK_TIMEOUT_MS || waitedMs >= LOCK_UNREADABLE_GRACE_MS
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
      const waitedMs = Date.now() - startedAt
      if (await tryRemoveStaleLock(lockPath, waitedMs)) continue
      if (waitedMs >= LOCK_TIMEOUT_MS) {
        throw new Error(t('settings.lock.busy'))
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
