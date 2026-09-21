import { create } from 'zustand'

import { DEFAULT_SCREEN, type Screen } from '../navigation/registry.ts'

type RouterState = {
  screen: Screen
  goTo: (screen: Screen) => void
}

export const useRouterStore = create<RouterState>()((set) => ({
  screen: DEFAULT_SCREEN,
  goTo: (screen) => set({ screen }),
}))
