import { create } from 'zustand'

type DialogMenuState = {
  open: boolean
  toggle: () => void
  close: () => void
}

export const useDialogMenuStore = create<DialogMenuState>()((set) => ({
  open: false,
  toggle: () => set((state) => ({ open: !state.open })),
  close: () => set({ open: false }),
}))
