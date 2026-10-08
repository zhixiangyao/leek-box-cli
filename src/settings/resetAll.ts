import { useSettingsStore } from '../stores/useSettingsStore.ts'
import { useStockListStore } from '../stores/useStockListStore.ts'
import { resetSettingsFile } from './file.ts'

/** 全量重置: 重置设置文件为默认文档, 再同步设置与自选股内存 */
export async function resetAll(): Promise<void> {
  await resetSettingsFile()
  useSettingsStore.getState().resetSettings()
  await useStockListStore.getState().refreshQuotes()
}
