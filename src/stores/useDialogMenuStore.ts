import { create } from 'zustand'

import { type MenuItem } from '../navigation/menu.ts'

type DialogMenuState = {
  open: boolean
  highlightedType: MenuItem['type']
  toggle: () => void
  close: () => void
  setHighlightedType: (highlightedType: MenuItem['type']) => void
}

export const useDialogMenuStore = create<DialogMenuState>()((set) => ({
  open: false,
  highlightedType: 'stock-list',
  toggle: () => set((state) => ({ open: !state.open })),
  close: () => set({ open: false }),
  setHighlightedType: (highlightedType) => set({ highlightedType }),
}))
