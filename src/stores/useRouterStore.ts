import { create } from 'zustand'

import type { Screen } from '../lib/screens.ts'

type RouterState = {
  screen: Screen
  goTo: (screen: Screen) => void
}

export const useRouterStore = create<RouterState>()((set) => ({
  screen: 'stock-list',
  goTo: (screen) => set({ screen }),
}))
