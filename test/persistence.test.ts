import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { type SettingsDocument } from '../src/settings/schema.ts'
import { useSettingsStore } from '../src/stores/useSettingsStore.ts'

const fileMocks = vi.hoisted(() => ({
  initializeSettings: vi.fn(),
  patchSettings: vi.fn(),
}))

vi.mock('../src/settings/file.ts', () => fileMocks)

import { startSettingsPersistence } from '../src/settings/persistence.ts'

const document = (): SettingsDocument => ({
  theme: { preset: 'classic', trendColorMode: 'red-up', borderStyle: 'round' },
  request: {
    timeoutMs: 8000,
    minimumDurationMs: 0,
    quotePollIntervalMs: 5000,
    minuteChartPollIntervalMs: 30_000,
    klinePollIntervalMs: 300_000,
  },
  stocks: [],
})

const advanceDebounce = () => vi.advanceTimersByTimeAsync(150)

beforeEach(() => {
  vi.useFakeTimers()
  fileMocks.initializeSettings.mockReset()
  fileMocks.patchSettings.mockReset()
  fileMocks.initializeSettings.mockResolvedValue(document())
  fileMocks.patchSettings.mockResolvedValue(undefined)
  useSettingsStore.setState(useSettingsStore.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
})

test('启动时从文件 hydrate 设置', async () => {
  const persistence = await startSettingsPersistence(() => undefined)

  expect(useSettingsStore.getState().themePreset).toBe('classic')
  expect(useSettingsStore.getState().requestTimeoutMs).toBe(8000)
  await persistence.stop()
})

test('设置变化在 debounce 后保存变化的字段', async () => {
  const persistence = await startSettingsPersistence(() => undefined)
  useSettingsStore.getState().updateSettings({ themePreset: 'ocean', borderStyle: 'double' })

  expect(fileMocks.patchSettings).not.toHaveBeenCalled()
  await advanceDebounce()
  expect(fileMocks.patchSettings).toHaveBeenCalledTimes(1)
  expect(fileMocks.patchSettings).toHaveBeenCalledWith({ themePreset: 'ocean', borderStyle: 'double' })
  await persistence.stop()
})

test('debounce 窗口内的连续修改合并为一次保存', async () => {
  const persistence = await startSettingsPersistence(() => undefined)
  useSettingsStore.getState().updateSettings({ themePreset: 'ocean' })
  await vi.advanceTimersByTimeAsync(60)
  useSettingsStore.getState().updateSettings({ quotePollIntervalMs: 8000 })
  await vi.advanceTimersByTimeAsync(60)
  useSettingsStore.getState().updateSettings({ themePreset: 'forest' })

  await advanceDebounce()
  expect(fileMocks.patchSettings).toHaveBeenCalledTimes(1)
  expect(fileMocks.patchSettings).toHaveBeenCalledWith({ themePreset: 'forest', quotePollIntervalMs: 8000 })
  await persistence.stop()
})

test('stop 立即 flush 尚未保存的修改', async () => {
  const persistence = await startSettingsPersistence(() => undefined)
  useSettingsStore.getState().updateSettings({ requestTimeoutMs: 10_000 })

  expect(await persistence.stop()).toBe(true)
  expect(fileMocks.patchSettings).toHaveBeenCalledTimes(1)
  expect(fileMocks.patchSettings).toHaveBeenCalledWith({ requestTimeoutMs: 10_000 })
})

test('stop 是幂等的, 后续调用不会重复保存', async () => {
  const persistence = await startSettingsPersistence(() => undefined)
  useSettingsStore.getState().updateSettings({ quotePollIntervalMs: 7000 })

  const first = persistence.stop()
  const second = persistence.stop()
  expect(await first).toBe(true)
  expect(await second).toBe(true)
  expect(fileMocks.patchSettings).toHaveBeenCalledTimes(1)
})

test('stop 后取消订阅, 后续修改不再写文件', async () => {
  const persistence = await startSettingsPersistence(() => undefined)
  await persistence.stop()

  useSettingsStore.getState().updateSettings({ themePreset: 'sunset' })
  await advanceDebounce()
  expect(fileMocks.patchSettings).not.toHaveBeenCalled()
})

test('未修改任何设置时 stop 不写文件', async () => {
  const persistence = await startSettingsPersistence(() => undefined)
  expect(await persistence.stop()).toBe(true)
  expect(fileMocks.patchSettings).not.toHaveBeenCalled()
})

test('保存失败时通知错误处理器并保留 pending patch 重试', async () => {
  const errors: unknown[] = []
  fileMocks.patchSettings.mockRejectedValueOnce(new Error('磁盘已满'))
  const persistence = await startSettingsPersistence((error) => errors.push(error))

  useSettingsStore.getState().updateSettings({ themePreset: 'ocean' })
  await advanceDebounce()
  expect(errors).toStrictEqual([new Error('磁盘已满')])
  expect(fileMocks.patchSettings).toHaveBeenCalledTimes(1)

  // 下一次修改触发重试, 成功清空错误
  useSettingsStore.getState().updateSettings({ borderStyle: 'bold' })
  await advanceDebounce()
  expect(fileMocks.patchSettings).toHaveBeenCalledTimes(2)
  expect(fileMocks.patchSettings).toHaveBeenLastCalledWith({ themePreset: 'ocean', borderStyle: 'bold' })
  expect(await persistence.stop()).toBe(true)
})

test('保存失败且无新修改时 stop 重试并报告失败', async () => {
  const errors: unknown[] = []
  fileMocks.patchSettings.mockRejectedValue(new Error('只读文件系统'))
  const persistence = await startSettingsPersistence((error) => errors.push(error))

  useSettingsStore.getState().updateSettings({ klinePollIntervalMs: 600_000 })
  await advanceDebounce()
  expect(errors).toHaveLength(1)

  // stop 依次执行 flush 重试和显式重试, 均失败并报告
  expect(await persistence.stop()).toBe(false)
  expect(fileMocks.patchSettings).toHaveBeenCalledTimes(3)
  expect(errors).toHaveLength(3)
})

test('错误处理器本身抛错不影响持久化流程', async () => {
  fileMocks.patchSettings.mockRejectedValueOnce(new Error('写入失败'))
  const persistence = await startSettingsPersistence(() => {
    throw new Error('日志器也坏了')
  })

  useSettingsStore.getState().updateSettings({ themePreset: 'gray' })
  await advanceDebounce()

  // 下一次修改仍能继续尝试保存
  fileMocks.patchSettings.mockResolvedValue(undefined)
  useSettingsStore.getState().updateSettings({ borderStyle: 'arrow' })
  await advanceDebounce()
  expect(await persistence.stop()).toBe(true)
})

test('hydrate 时越界值被钳制回合法区间', async () => {
  fileMocks.initializeSettings.mockResolvedValue({
    ...document(),
    request: {
      timeoutMs: 999_999,
      minimumDurationMs: 0,
      quotePollIntervalMs: 0,
      minuteChartPollIntervalMs: 30_000,
      klinePollIntervalMs: 300_000,
    },
  })

  await startSettingsPersistence(() => undefined)
  expect(useSettingsStore.getState().requestTimeoutMs).toBe(60_000)
  expect(useSettingsStore.getState().quotePollIntervalMs).toBe(1000)
})
