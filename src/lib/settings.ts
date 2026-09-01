import { randomUUID } from 'node:crypto'
import { link, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

import {
  BORDER_STYLES,
  DEFAULT_SETTINGS,
  DEFAULT_TREND_COLOR_MODE,
  SETTING_LIMITS,
  TREND_COLOR_MODES,
  type Settings,
  type ThemePreset,
  type TrendColorMode,
  THEME_PRESET_NAMES,
} from '../stores/useSettingsStore.ts'
import { isWindows } from './env.ts'

export type StockEntry = {
  /** 股票代码 */
  code: string
  /** 股票名称 */
  name: string
  /** 添加时间(ISO 时间) */
  addedAt: string
}

const WATCH_CODE_PATTERN = /^(?:sh|sz|bj)\d{6}$/

/** 解析并验证单个股票条目 */
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

/** 解析并验证股票条目列表 */
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
    trendColorMode: Settings['trendColorMode']
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

/** 判断值是否为普通对象 */
const isNormalObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 验证主题预设名称 */
const parseThemePreset = (value: unknown): ThemePreset => {
  if (typeof value !== 'string' || !THEME_PRESET_NAMES.includes(value as ThemePreset)) {
    throw new Error('theme.preset 无效')
  }
  return value as ThemePreset
}

/** 验证涨跌颜色模式 */
const parseTrendColorMode = (value: unknown): TrendColorMode => {
  if (value === undefined) return DEFAULT_TREND_COLOR_MODE
  if (typeof value !== 'string' || !TREND_COLOR_MODES.includes(value as TrendColorMode)) {
    throw new Error('theme.trendColorMode 无效')
  }
  return value as TrendColorMode
}

/** 验证范围内的整数配置值 */
const parseInteger = (value: unknown, name: string, limits: { min: number; max: number }) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < limits.min || value > limits.max) {
    throw new Error(`${name} 无效`)
  }
  return value
}

/** 解析并验证完整设置文档 */
export function parseSettingsDocument(value: unknown): SettingsDocument {
  if (!isNormalObject(value)) throw new Error('顶层数据不是对象')

  const theme = value['theme']
  if (!isNormalObject(theme)) throw new Error('theme 无效')
  const borderStyle = theme['borderStyle']
  if (typeof borderStyle !== 'string' || !BORDER_STYLES.includes(borderStyle as Settings['borderStyle'])) {
    throw new Error('theme.borderStyle 无效')
  }

  const request = value['request']
  if (!isNormalObject(request)) throw new Error('request 无效')
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
      trendColorMode: parseTrendColorMode(theme['trendColorMode']),
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

/** 将设置文档转换为应用设置 */
export function settingsFromDocument(document: SettingsDocument): Settings {
  return {
    themePreset: document.theme.preset,
    trendColorMode: document.theme.trendColorMode,
    borderStyle: document.theme.borderStyle,
    requestTimeoutMs: document.request.timeoutMs,
    minimumRequestDurationMs: document.request.minimumDurationMs,
    quotePollIntervalMs: document.request.quotePollIntervalMs,
    minuteChartPollIntervalMs: document.request.minuteChartPollIntervalMs,
    klinePollIntervalMs: document.request.klinePollIntervalMs,
  }
}

/** 首次使用时预置的默认自选股 */
const DEFAULT_STOCKS: ReadonlyArray<Pick<StockEntry, 'code' | 'name'>> = [
  { code: 'sz002156', name: '富通微电' },
  { code: 'sh600584', name: '长电科技' },
  { code: 'sh688825', name: '长鑫科技' },
]

/** 构造默认自选股列表, 使用当前时间作为添加时间 */
const createDefaultStocks = (): StockEntry[] => {
  const addedAt = new Date().toISOString()
  return DEFAULT_STOCKS.map((stock) => ({ ...stock, addedAt }))
}

/** 组合应用设置和股票条目为持久化文档 */
const createDocument = (settings: Settings, stocks: StockEntry[]): SettingsDocument => ({
  theme: {
    preset: settings.themePreset,
    trendColorMode: settings.trendColorMode,
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

/** 返回应用配置目录 */
const configDirectory = () => {
  // 显式设置的 XDG_CONFIG_HOME 优先, 空字符串按未设置处理(遵循 XDG 规范).
  const explicitConfigHome = process.env['XDG_CONFIG_HOME']
  if (explicitConfigHome) return join(explicitConfigHome, 'leek-box-cli')
  // Windows 使用 %APPDATA% (Roaming), 缺失时回退到用户目录下的 .config.
  if (isWindows) {
    const appData = process.env['APPDATA']
    if (appData) return join(appData, 'leek-box-cli')
  }
  return join(homedir(), '.config', 'leek-box-cli')
}

/** 返回设置文件路径 */
export function settingsPath(): string {
  return join(configDirectory(), 'settings.json')
}

/** 去除 UTF-8 BOM, 兼容 Windows 编辑器(如记事本, PowerShell 重定向)写入的配置文件 */
const stripBom = (text: string): string => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)

/** 读取 JSON 文件, 不存在时返回 undefined */
const readJsonFile = async (path: string): Promise<unknown | undefined> => {
  try {
    return JSON.parse(stripBom(await readFile(path, 'utf8'))) as unknown
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/** 读取并验证设置文件 */
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

/** 原子写入已验证的设置文档 */
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

/** 尝试清理过期的设置锁 */
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

/** 发布新的跨进程设置锁 */
const publishLock = async (lockPath: string, contents: string) => {
  const temporaryPath = `${lockPath}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' })
    await link(temporaryPath, lockPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

/** 在设置锁保护下执行异步操作 */
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

/** 在锁内创建默认设置文档 */
const initializeUnlocked = async (): Promise<SettingsDocument> => {
  const existing = await readSettingsFile()
  if (existing) return existing

  const document = createDocument(DEFAULT_SETTINGS, createDefaultStocks())
  await writeSettingsFile(document)
  return document
}

/** 初始化并返回设置文档 */
export async function initializeSettings(): Promise<SettingsDocument> {
  return (await readSettingsFile()) ?? withSettingsLock(initializeUnlocked)
}

/** 加载完整设置文档 */
export const loadSettingsDocument = initializeSettings

/** 在锁内将设置文件重置为默认文档, 不读取现有内容, 损坏文件也能修复 */
export async function resetSettingsFile(): Promise<void> {
  const document = createDocument(DEFAULT_SETTINGS, createDefaultStocks())
  await withSettingsLock(async () => {
    await writeSettingsFile(document)
  })
}

/** 在锁内更新部分应用设置 */
export async function patchSettings(patch: Partial<Settings>): Promise<void> {
  await withSettingsLock(async () => {
    const current = await initializeUnlocked()
    const settings = { ...settingsFromDocument(current), ...patch }
    await writeSettingsFile(createDocument(settings, current.stocks))
  })
}

/** 加载当前自选股列表 */
export async function loadStocks(): Promise<StockEntry[]> {
  return (await loadSettingsDocument()).stocks
}

/** 使用完整列表替换全部自选股 */
export async function replaceStocks(stocks: StockEntry[]): Promise<void> {
  const normalized = parseStocks(stocks)
  await withSettingsLock(async () => {
    const current = await initializeUnlocked()
    await writeSettingsFile({ ...current, stocks: normalized })
  })
}

/** 批量添加不存在的自选股, 返回新增数量 */
export async function stocksAdd(entries: StockEntry[]): Promise<number> {
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

/** 批量删除匹配代码的自选股, 返回删除数量 */
export async function stocksRemove(codes: string[]): Promise<number> {
  const codesToRemove = new Set(codes)
  if (codesToRemove.size === 0) return 0

  return withSettingsLock(async () => {
    const current = await initializeUnlocked()
    const stocks = current.stocks.filter((entry) => !codesToRemove.has(entry.code))
    const removedCount = current.stocks.length - stocks.length
    if (removedCount > 0) await writeSettingsFile({ ...current, stocks })
    return removedCount
  })
}
