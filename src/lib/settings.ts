import { randomUUID } from 'node:crypto'
import { link, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

import {
  BORDER_STYLES,
  DEFAULT_SETTINGS,
  SETTING_LIMITS,
  type Settings,
  type ThemePreset,
  THEME_PRESET_NAMES,
} from '../stores/useSettingsStore.ts'

export type StockEntry = {
  /** 股票代码 */
  code: string
  /** 股票名称 */
  name: string
  /** 添加时间(ISO 时间) */
  addedAt: string
}

const WATCH_CODE_PATTERN = /^(?:sh|sz|bj)\d{6}$/

const parseStock = (value: unknown, index: number): StockEntry => {
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

export function parseStocks(value: unknown): StockEntry[] {
  if (!Array.isArray(value)) throw new Error('stocks 不是数组')
  const entries = value.map(parseStock)
  const seen = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    if (seen.has(entry.code)) throw new Error(`第 ${index + 1} 项 code 重复: ${entry.code}`)
    seen.add(entry.code)
  }
  return entries
}

const LOCK_RETRY_MS = 25
const LOCK_TIMEOUT_MS = 2000
const LOCK_STALE_MS = 30_000

export type SettingsDocument = {
  theme: {
    preset: Settings['themePreset']
    borderStyle: Settings['borderStyle']
  }
  request: {
    timeoutMs: number
    minimumDurationMs: number
    quotePollIntervalMs: number
    minuteChartPollIntervalMs: number
    klinePollIntervalMs: number
  }
  stocks: StockEntry[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseThemePreset = (value: unknown): ThemePreset => {
  if (typeof value !== 'string' || !THEME_PRESET_NAMES.includes(value as ThemePreset)) {
    throw new Error('theme.preset 无效')
  }
  return value as ThemePreset
}

const parseInteger = (value: unknown, name: string, limits: { min: number; max: number }) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < limits.min || value > limits.max) {
    throw new Error(`${name} 无效`)
  }
  return value
}

export function parseSettingsDocument(value: unknown): SettingsDocument {
  if (!isRecord(value)) throw new Error('顶层数据不是对象')

  const theme = value['theme']
  if (!isRecord(theme)) throw new Error('theme 无效')
  const borderStyle = theme['borderStyle']
  if (typeof borderStyle !== 'string' || !BORDER_STYLES.includes(borderStyle as Settings['borderStyle'])) {
    throw new Error('theme.borderStyle 无效')
  }

  const request = value['request']
  if (!isRecord(request)) throw new Error('request 无效')
  const timeoutMs = parseInteger(request['timeoutMs'], 'request.timeoutMs', SETTING_LIMITS.requestTimeoutMs)
  const minimumDurationMs = parseInteger(
    request['minimumDurationMs'],
    'request.minimumDurationMs',
    SETTING_LIMITS.minimumRequestDurationMs,
  )
  if (minimumDurationMs > timeoutMs) throw new Error('request.minimumDurationMs 不能大于 request.timeoutMs')

  return {
    theme: {
      preset: parseThemePreset(theme['preset']),
      borderStyle: borderStyle as Settings['borderStyle'],
    },
    request: {
      timeoutMs,
      minimumDurationMs,
      quotePollIntervalMs: parseInteger(
        request['quotePollIntervalMs'],
        'request.quotePollIntervalMs',
        SETTING_LIMITS.quotePollIntervalMs,
      ),
      minuteChartPollIntervalMs: parseInteger(
        request['minuteChartPollIntervalMs'],
        'request.minuteChartPollIntervalMs',
        SETTING_LIMITS.minuteChartPollIntervalMs,
      ),
      klinePollIntervalMs: parseInteger(
        request['klinePollIntervalMs'],
        'request.klinePollIntervalMs',
        SETTING_LIMITS.klinePollIntervalMs,
      ),
    },
    stocks: parseStocks(value['stocks']),
  }
}

export function settingsFromDocument(document: SettingsDocument): Settings {
  return {
    themePreset: document.theme.preset,
    borderStyle: document.theme.borderStyle,
    requestTimeoutMs: document.request.timeoutMs,
    minimumRequestDurationMs: document.request.minimumDurationMs,
    quotePollIntervalMs: document.request.quotePollIntervalMs,
    minuteChartPollIntervalMs: document.request.minuteChartPollIntervalMs,
    klinePollIntervalMs: document.request.klinePollIntervalMs,
  }
}

const createDocument = (settings: Settings, stocks: StockEntry[]): SettingsDocument => ({
  theme: {
    preset: settings.themePreset,
    borderStyle: settings.borderStyle,
  },
  request: {
    timeoutMs: settings.requestTimeoutMs,
    minimumDurationMs: settings.minimumRequestDurationMs,
    quotePollIntervalMs: settings.quotePollIntervalMs,
    minuteChartPollIntervalMs: settings.minuteChartPollIntervalMs,
    klinePollIntervalMs: settings.klinePollIntervalMs,
  },
  stocks,
})

const configDirectory = () => {
  const configHome = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config')
  return join(configHome, 'leek-box-cli')
}

export function settingsPath(): string {
  return join(configDirectory(), 'settings.json')
}

const readJsonFile = async (path: string): Promise<unknown | undefined> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

const readSettingsFile = async (): Promise<SettingsDocument | undefined> => {
  const path = settingsPath()
  try {
    const value = await readJsonFile(path)
    return value === undefined ? undefined : parseSettingsDocument(value)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`设置文件损坏: ${path} (${reason})`)
  }
}

const writeSettingsFile = async (document: SettingsDocument): Promise<void> => {
  const normalized = parseSettingsDocument(document)
  const path = settingsPath()
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, path)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs))

const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

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
      !isRecord(metadata) ||
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

const publishLock = async (lockPath: string, contents: string) => {
  const temporaryPath = `${lockPath}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' })
    await link(temporaryPath, lockPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

async function withSettingsLock<Result>(operation: () => Promise<Result>): Promise<Result> {
  const path = settingsPath()
  const lockPath = `${path}.lock`
  const lockToken = randomUUID()
  const lockContents = JSON.stringify({ token: lockToken, pid: process.pid, createdAt: Date.now() })
  await mkdir(dirname(path), { recursive: true })
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
        throw new Error('设置文件正被其他进程占用, 请稍后重试')
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

const initializeUnlocked = async (): Promise<SettingsDocument> => {
  const existing = await readSettingsFile()
  if (existing) return existing

  const document = createDocument(DEFAULT_SETTINGS, [])
  await writeSettingsFile(document)
  return document
}

export async function initializeSettings(): Promise<SettingsDocument> {
  return (await readSettingsFile()) ?? withSettingsLock(initializeUnlocked)
}

export const loadSettingsDocument = initializeSettings

export async function patchSettings(patch: Partial<Settings>): Promise<void> {
  await withSettingsLock(async () => {
    const current = await initializeUnlocked()
    const settings = { ...settingsFromDocument(current), ...patch }
    await writeSettingsFile(createDocument(settings, current.stocks))
  })
}

export async function loadStocks(): Promise<StockEntry[]> {
  return (await loadSettingsDocument()).stocks
}

export async function replaceStocks(stocks: StockEntry[]): Promise<void> {
  const normalized = parseStocks(stocks)
  await withSettingsLock(async () => {
    const current = await initializeUnlocked()
    await writeSettingsFile({ ...current, stocks: normalized })
  })
}

export async function addStocks(entries: StockEntry[]): Promise<number> {
  const normalized = parseStocks(entries)
  return withSettingsLock(async () => {
    const current = await initializeUnlocked()
    const existingCodes = new Set(current.stocks.map((entry) => entry.code))
    const additions = normalized.filter((entry) => !existingCodes.has(entry.code))
    if (additions.length > 0) {
      await writeSettingsFile({ ...current, stocks: [...current.stocks, ...additions] })
    }
    return additions.length
  })
}

export async function addStock(entry: StockEntry): Promise<{ status: 'added' | 'duplicate' }> {
  return (await addStocks([entry])) === 1 ? { status: 'added' } : { status: 'duplicate' }
}

export async function removeStock(code: string): Promise<StockEntry | undefined> {
  return withSettingsLock(async () => {
    const current = await initializeUnlocked()
    const index = current.stocks.findIndex((item) => item.code === code)
    if (index < 0) return undefined
    const stocks = [...current.stocks]
    const [removed] = stocks.splice(index, 1)
    await writeSettingsFile({ ...current, stocks })
    return removed
  })
}
