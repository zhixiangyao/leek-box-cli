import { create } from 'zustand'

type DialogMenuState = {
  open: boolean
  highlight: number
  toggle: () => void
  close: () => void
  setHighlight: (index: number) => void
}

export const useDialogMenuStore = create<DialogMenuState>()((set) => ({
  open: false,
  highlight: 0,
  toggle: () => set((state) => ({ open: !state.open })),
  close: () => set({ open: false, highlight: 0 }),
  setHighlight: (index) => set({ highlight: index }),
}))
