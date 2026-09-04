import { beforeEach, expect, test, vi } from 'vitest'

import { resetSettingsFile } from '../src/settings/file.ts'
import { resetAll } from '../src/settings/resetAll.ts'
import { DEFAULT_SETTINGS } from '../src/settings/schema.ts'
import { settingsSnapshot, useSettingsStore } from '../src/stores/useSettingsStore.ts'
import { useStockListStore } from '../src/stores/useStockListStore.ts'

vi.mock('../src/settings/file.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/settings/file.ts')>()),
  resetSettingsFile: vi.fn(),
}))

const refreshQuotes = vi.fn<() => Promise<void>>()

beforeEach(() => {
  vi.mocked(resetSettingsFile).mockReset()
  refreshQuotes.mockReset()
  useSettingsStore.setState(useSettingsStore.getInitialState(), true)
  useStockListStore.setState({ refreshQuotes })
})

test('resetAll 重置文件后同步设置与自选股内存', async () => {
  vi.mocked(resetSettingsFile).mockResolvedValue(undefined)
  useSettingsStore.getState().updateSettings({ themePreset: 'ocean' })

  await resetAll()

  expect(resetSettingsFile).toHaveBeenCalledTimes(1)
  expect(settingsSnapshot(useSettingsStore.getState())).toStrictEqual(DEFAULT_SETTINGS)
  expect(refreshQuotes).toHaveBeenCalledTimes(1)
  // 文件重置先于内存同步
  expect(vi.mocked(resetSettingsFile).mock.invocationCallOrder[0]).toBeLessThan(
    refreshQuotes.mock.invocationCallOrder[0]!,
  )
})

test('resetAll 文件重置失败时保持内存不变且不刷新自选股', async () => {
  vi.mocked(resetSettingsFile).mockRejectedValueOnce(new Error('锁超时'))
  useSettingsStore.getState().updateSettings({ themePreset: 'ocean' })

  await expect(resetAll()).rejects.toThrow('锁超时')
  expect(useSettingsStore.getState().themePreset).toBe('ocean')
  expect(refreshQuotes).not.toHaveBeenCalled()
})
