import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'

import { t } from '../i18n/core.ts'
import { errorMessage } from '../lib/error.ts'
import { isWindows } from '../lib/is.ts'
import { APP_VERSION } from '../lib/version.ts'
import { withFileLock } from './lock.ts'
import {
  createDocument,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  parseSettingsDocument,
  parseStocks,
  SchemaVersionTooNewError,
  type Settings,
  type SettingsDocument,
  settingsFromDocument,
  type StockEntry,
} from './schema.ts'

/** 返回应用配置目录 */
const configDirectory = () => {
  // 显式设置的 XDG_CONFIG_HOME 优先, 空字符串按未设置处理(遵循 XDG 规范).
  const explicitConfigHome = process.env['XDG_CONFIG_HOME']
  if (explicitConfigHome) return join(explicitConfigHome, 'leek-box-cli')
  // Windows 使用 %APPDATA% (Roaming), 缺失时回退到用户目录下的 .config.
  if (isWindows()) {
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

/** 读取并验证设置文件, 不存在时返回 undefined, 不创建文件 */
export const loadExistingSettings = async (): Promise<SettingsDocument | undefined> => {
  const path = settingsPath()
  try {
    const value = await readJsonFile(path)
    return value === undefined ? undefined : parseSettingsDocument(value, path)
  } catch (error) {
    // 版本过新不是文件损坏: 原样抛出, 让用户看到 "请升级" 而不是 "文件损坏"
    if (error instanceof SchemaVersionTooNewError) throw error
    throw new Error(t('settings.error.corruptFile', { path, error: errorMessage(error) }))
  }
}

/**
 * 原子写入设置文档. 先校验再盖版本字段, 两步都必要:
 * 校验拦下读不懂的文档 (版本过新的文档不该被降级重写), 盖章让写出去的文档总是描述当前程序.
 */
const writeSettingsFile = async (document: SettingsDocument): Promise<void> => {
  const path = settingsPath()
  const normalized = parseSettingsDocument(document, path)
  // 版本字段描述的是写入它的程序, 不是文件自身的历史结构, 因此不沿用文档里的旧值
  const stamped = { ...normalized, schemaVersion: CURRENT_SCHEMA_VERSION, appVersion: APP_VERSION }
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(stamped, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, path)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

const DEFAULT_STOCK_CODES: readonly string[] = ['sz002156', 'sh600584', 'sh688825']

/** 构造默认自选股列表, 使用当前时间作为添加时间 */
const createDefaultStocks = (): StockEntry[] => {
  const addedAt = new Date().toISOString()
  return DEFAULT_STOCK_CODES.map((code) => ({ code, addedAt }))
}

/** 在锁内读取设置文件, 不存在时创建默认文档 */
const loadOrCreateSettings = async (): Promise<SettingsDocument> => {
  const existing = await loadExistingSettings()
  if (existing) return existing

  const document = createDocument(DEFAULT_SETTINGS, createDefaultStocks())
  await writeSettingsFile(document)
  return document
}

/** 初始化并返回设置文档 */
export async function initializeSettings(): Promise<SettingsDocument> {
  return (await loadExistingSettings()) ?? withFileLock(settingsPath(), loadOrCreateSettings)
}

/**
 * 在锁内将设置文件重置为默认文档: 覆盖现有内容, 损坏文件也能修复.
 * 只有版本过新的文件例外, 它不算损坏, 只是这份程序读不懂, 覆盖它等于丢数据
 * (与读改写路径同一条判断; 重设不是它的逃生门, 用户只能升级或手动处理该文件).
 */
export async function resetSettingsFile(): Promise<void> {
  const document = createDocument(DEFAULT_SETTINGS, createDefaultStocks())
  await withFileLock(settingsPath(), async () => {
    try {
      // 只为判断, 结果不用: 读得出来就照常覆盖, 读不出来 (损坏或缺失) 由下面的写入修成一个合法文档
      await loadExistingSettings()
    } catch (error) {
      if (error instanceof SchemaVersionTooNewError) throw error
    }
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
