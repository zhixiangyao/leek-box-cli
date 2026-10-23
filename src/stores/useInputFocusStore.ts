import { create } from 'zustand'

type InputFocusState = {
  activeCount: number
  focus: () => void
  blur: () => void
}

export const useInputFocusStore = create<InputFocusState>()((set) => ({
  activeCount: 0,
  focus: () => set((state) => ({ activeCount: state.activeCount + 1 })),
  blur: () => set((state) => ({ activeCount: Math.max(0, state.activeCount - 1) })),
}))
