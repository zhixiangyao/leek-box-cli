import { create } from 'zustand'

import { type MenuItem } from '../navigation/menu.ts'

type DialogMenuState = {
  highlightedType: MenuItem['type'] | undefined
  open: (highlightedType: MenuItem['type']) => void
  close: () => void
  setHighlightedType: (highlightedType: MenuItem['type']) => void
}

export const useDialogMenuStore = create<DialogMenuState>()((set) => ({
  highlightedType: undefined,
  open: (highlightedType) => set({ highlightedType }),
  close: () => set({ highlightedType: undefined }),
  setHighlightedType: (highlightedType) => set({ highlightedType }),
}))
