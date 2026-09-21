import { create } from 'zustand'

export type DialogConfirmConfig = { title: string; content: string; isError: boolean; confirm: () => Promise<void> }

export type DialogConfirmUpdate = Partial<Pick<NonNullable<DialogConfirmConfig>, 'title' | 'content' | 'isError'>>

type DialogConfirmState = {
  config: DialogConfirmConfig | undefined
  open: (config: DialogConfirmConfig) => void
  close: () => void
  update: (patch: DialogConfirmUpdate) => void
}

export const useDialogConfirmStore = create<DialogConfirmState>()((set) => ({
  config: undefined,
  open: (config) => set({ config }),
  close: () => set({ config: undefined }),
  update: (patch) =>
    set((state) => {
      if (!state.config) return state
      return { config: { ...state.config, ...patch } }
    }),
}))
