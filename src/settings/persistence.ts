import { settingsEqual, settingsPatch, useSettingsStore } from '../stores/useSettingsStore.ts'
import { initializeSettings, patchSettings } from './file.ts'
import { type Settings, settingsFromDocument } from './schema.ts'

const SAVE_DEBOUNCE_MS = 100

export type SettingsPersistence = {
  stop: () => Promise<boolean>
}

type PersistenceErrorHandler = (error: unknown) => void

const hasSettingsPatch = (patch: Partial<Settings>) => Object.keys(patch).length > 0

export async function startSettingsPersistence(
  onPersistenceError: PersistenceErrorHandler,
): Promise<SettingsPersistence> {
  const document = await initializeSettings()
  useSettingsStore.getState().hydrateSettings(settingsFromDocument(document))

  let pendingPatch: Partial<Settings> = {}
  let persistenceError: unknown
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let saveQueue = Promise.resolve()

  const savePendingPatch = async () => {
    if (!hasSettingsPatch(pendingPatch)) return
    const patch = pendingPatch
    pendingPatch = {}

    try {
      await patchSettings(patch)
      persistenceError = undefined
    } catch (error) {
      pendingPatch = { ...patch, ...pendingPatch }
      persistenceError = error
      try {
        onPersistenceError(error)
      } catch {
        // Persistence must not stop because an error reporter failed.
      }
    }
  }

  const flush = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = undefined
    }
    saveQueue = saveQueue.then(savePendingPatch)
    return saveQueue
  }

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void flush()
    }, SAVE_DEBOUNCE_MS)
  }

  const unsubscribe = useSettingsStore.subscribe((state, previousState) => {
    if (settingsEqual(state, previousState)) return
    pendingPatch = { ...pendingPatch, ...settingsPatch(state, previousState) }
    scheduleSave()
  })

  let stopResult: Promise<boolean> | undefined
  const stop = async () => {
    unsubscribe()
    await flush()
    if (persistenceError && hasSettingsPatch(pendingPatch)) await savePendingPatch()
    return persistenceError === undefined
  }

  return {
    stop: () => (stopResult ??= stop()),
  }
}
