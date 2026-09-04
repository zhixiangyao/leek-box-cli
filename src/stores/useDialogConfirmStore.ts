import { create } from 'zustand'

export type DialogConfirmConfig = { title: string; content: string; isError: boolean; confirm: () => Promise<void> }

export type DialogConfirmUpdate = Partial<Pick<NonNullable<DialogConfirmConfig>, 'title' | 'content' | 'isError'>>

type DialogConfirmState = {
  config: DialogConfirmConfig | undefined
  open: (config: DialogConfirmConfig) => void
  update: (patch: DialogConfirmUpdate) => void
  close: () => void
}

export const useDialogConfirmStore = create<DialogConfirmState>()((set) => ({
  config: undefined,
  open: (config) => set({ config }),
  update: (patch) =>
    set((state) => {
      if (!state.config) return state
      return { config: { ...state.config, ...patch } }
    }),
  close: () => set({ config: undefined }),
}))
