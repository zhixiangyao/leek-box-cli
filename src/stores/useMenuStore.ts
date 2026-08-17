import { create } from 'zustand'

type MenuState = {
  open: boolean
  toggle: () => void
  close: () => void
}

export const useMenuStore = create<MenuState>()((set) => ({
  open: false,
  toggle: () => set((state) => ({ open: !state.open })),
  close: () => set({ open: false }),
}))
