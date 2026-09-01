import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

import { errorMessage } from '../lib/error.ts'
import { withFileLock } from './lock.ts'
import {
  createDocument,
  DEFAULT_SETTINGS,
  parseSettingsDocument,
  parseStocks,
  type Settings,
  type SettingsDocument,
  settingsFromDocument,
  type StockEntry,
} from './schema.ts'

const isWindows = process.platform === 'win32'

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
    throw new Error(`设置文件损坏: ${path} (${errorMessage(error)})`)
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

/** 在锁内读取设置文件, 不存在时创建默认文档 */
const loadOrCreateSettings = async (): Promise<SettingsDocument> => {
  const existing = await readSettingsFile()
  if (existing) return existing

  const document = createDocument(DEFAULT_SETTINGS, createDefaultStocks())
  await writeSettingsFile(document)
  return document
}

/** 初始化并返回设置文档 */
export async function initializeSettings(): Promise<SettingsDocument> {
  return (await readSettingsFile()) ?? withFileLock(settingsPath(), loadOrCreateSettings)
}

/** 在锁内将设置文件重置为默认文档, 不读取现有内容, 损坏文件也能修复 */
export async function resetSettingsFile(): Promise<void> {
  const document = createDocument(DEFAULT_SETTINGS, createDefaultStocks())
  await withFileLock(settingsPath(), async () => {
    await writeSettingsFile(document)
  })
}

/** 在锁内更新部分应用设置 */
export async function patchSettings(patch: Partial<Settings>): Promise<void> {
  await withFileLock(settingsPath(), async () => {
    const current = await loadOrCreateSettings()
    const settings = { ...settingsFromDocument(current), ...patch }
    await writeSettingsFile(createDocument(settings, current.stocks))
  })
}

/** 加载当前自选股列表 */
export async function loadStocks(): Promise<StockEntry[]> {
  return (await initializeSettings()).stocks
}

/** 使用完整列表替换全部自选股 */
export async function replaceStocks(stocks: StockEntry[]): Promise<void> {
  const normalized = parseStocks(stocks)
  await withFileLock(settingsPath(), async () => {
    const current = await loadOrCreateSettings()
    await writeSettingsFile({ ...current, stocks: normalized })
  })
}

/** 批量添加不存在的自选股, 返回新增数量 */
export async function stocksAdd(entries: StockEntry[]): Promise<number> {
  const normalized = parseStocks(entries)
  return withFileLock(settingsPath(), async () => {
    const current = await loadOrCreateSettings()
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

  return withFileLock(settingsPath(), async () => {
    const current = await loadOrCreateSettings()
    const stocks = current.stocks.filter((entry) => !codesToRemove.has(entry.code))
    const removedCount = current.stocks.length - stocks.length
    if (removedCount > 0) await writeSettingsFile({ ...current, stocks })
    return removedCount
  })
}
