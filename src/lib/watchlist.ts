import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

export type WatchEntry = {
  /** 股票代码 */
  code: string
  /** 股票名称 */
  name: string
  /** 添加时间(ISO 时间) */
  addedAt: string
}

const WATCH_CODE_PATTERN = /^(?:sh|sz|bj)\d{6}$/
const LOCK_RETRY_MS = 25
const LOCK_TIMEOUT_MS = 2000

export function watchlistPath(): string {
  const configHome = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config')
  return join(configHome, 'leek-box-cli', 'watchlist.json')
}

const parseEntry = (value: unknown, index: number): WatchEntry => {
  if (typeof value !== 'object' || value === null) throw new Error(`第 ${index + 1} 项不是对象`)
  const entry = value as Record<string, unknown>
  if (typeof entry['code'] !== 'string' || !WATCH_CODE_PATTERN.test(entry['code'])) {
    throw new Error(`第 ${index + 1} 项 code 无效`)
  }
  if (typeof entry['name'] !== 'string' || entry['name'].trim() === '') {
    throw new Error(`第 ${index + 1} 项 name 无效`)
  }
  if (typeof entry['addedAt'] !== 'string' || !Number.isFinite(Date.parse(entry['addedAt']))) {
    throw new Error(`第 ${index + 1} 项 addedAt 无效`)
  }
  return { code: entry['code'], name: entry['name'], addedAt: entry['addedAt'] }
}

export function parseWatchlist(value: unknown): WatchEntry[] {
  if (!Array.isArray(value)) throw new Error('顶层数据不是数组')
  const entries = value.map(parseEntry)
  const seen = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.code)) throw new Error(`第 ${index + 1} 项 code 重复: ${entry.code}`)
    seen.add(entry.code)
  }
  return entries
}

export async function loadWatchlist(): Promise<WatchEntry[]> {
  const path = watchlistPath()
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }

  try {
    return parseWatchlist(JSON.parse(raw) as unknown)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`自选股文件损坏: ${path} (${reason})`)
  }
}

export async function saveWatchlist(entries: WatchEntry[]): Promise<void> {
  parseWatchlist(entries)
  const path = watchlistPath()
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, path)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs))

async function withWatchlistLock<T>(operation: () => Promise<T>): Promise<T> {
  const path = watchlistPath()
  const lockPath = `${path}.lock`
  const lockToken = randomUUID()
  await mkdir(dirname(path), { recursive: true })
  const startedAt = Date.now()
  let handle: Awaited<ReturnType<typeof open>> | null = null

  while (!handle) {
    try {
      const candidate = await open(lockPath, 'wx')
      try {
        await candidate.writeFile(lockToken, 'utf8')
        handle = candidate
      } catch (error) {
        await candidate.close()
        await rm(lockPath, { force: true })
        throw error
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error('自选股文件正被其他进程占用, 请稍后重试')
      }
      await sleep(LOCK_RETRY_MS)
    }
  }

  let outcome: { ok: true; value: T } | { ok: false; error: unknown }
  try {
    outcome = { ok: true, value: await operation() }
  } catch (error) {
    outcome = { ok: false, error }
  }

  let cleanupError: unknown
  try {
    await handle.close()
    if ((await readFile(lockPath, 'utf8')) === lockToken) await rm(lockPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') cleanupError = error
  }

  if (!outcome.ok) throw outcome.error
  if (cleanupError) throw cleanupError
  return outcome.value
}

export async function addStock(entry: WatchEntry): Promise<{ status: 'added' | 'duplicate' }> {
  return withWatchlistLock(async () => {
    const entries = await loadWatchlist()
    if (entries.some((item) => item.code === entry.code)) return { status: 'duplicate' }
    entries.push(entry)
    await saveWatchlist(entries)
    return { status: 'added' }
  })
}

export async function removeStock(code: string): Promise<WatchEntry | null> {
  return withWatchlistLock(async () => {
    const entries = await loadWatchlist()
    const index = entries.findIndex((item) => item.code === code)
    if (index < 0) return null
    const [removed] = entries.splice(index, 1)
    await saveWatchlist(entries)
    return removed ?? null
  })
}
