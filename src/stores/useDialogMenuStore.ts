import { create } from 'zustand'

import { type Item } from '../cli/menu.ts'

type DialogMenuState = {
  open: boolean
  currentType: Item['type']
  toggle: () => void
  close: () => void
  setCurrentType: (currentType: Item['type']) => void
}

export const useDialogMenuStore = create<DialogMenuState>()((set) => ({
  open: false,
  currentType: 'stock-list',
  toggle: () => set((state) => ({ open: !state.open })),
  close: () => set({ open: false }),
  setCurrentType: (currentType) => set({ currentType }),
}))
