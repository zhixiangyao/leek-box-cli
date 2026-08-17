import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * 自选股存储: ~/.config/leek-box-cli/watchlist.json (遵循 XDG_CONFIG_HOME)
 * Schema: 裸数组 [{ code, name, addedAt }], 插入顺序即显示顺序,
 * name 在添加时缓存, 删除页离线也能显示名称
 */

export type WatchEntry = {
  code: string // 规范化代码, 如 'sh600000'
  name: string
  addedAt: string // ISO 时间
}

export function watchlistPath(): string {
  const configHome = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config')
  return join(configHome, 'leek-box-cli', 'watchlist.json')
}

export async function loadWatchlist(): Promise<WatchEntry[]> {
  let raw: string
  try {
    raw = await readFile(watchlistPath(), 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('not an array')
    return parsed.filter((item): item is WatchEntry => {
      return (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as WatchEntry).code === 'string' &&
        typeof (item as WatchEntry).name === 'string'
      )
    })
  } catch {
    throw new Error(`自选股文件损坏: ${watchlistPath()}, 请删除该文件后重试`)
  }
}

export async function saveWatchlist(entries: WatchEntry[]): Promise<void> {
  const path = watchlistPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
}

export async function addStock(entry: WatchEntry): Promise<{ status: 'added' | 'duplicate' }> {
  const entries = await loadWatchlist()
  if (entries.some((item) => item.code === entry.code)) {
    return { status: 'duplicate' }
  }
  entries.push(entry)
  await saveWatchlist(entries)
  return { status: 'added' }
}

export async function removeStock(code: string): Promise<WatchEntry | null> {
  const entries = await loadWatchlist()
  const index = entries.findIndex((item) => item.code === code)
  if (index < 0) return null
  const [removed] = entries.splice(index, 1)
  await saveWatchlist(entries)
  return removed ?? null
}
