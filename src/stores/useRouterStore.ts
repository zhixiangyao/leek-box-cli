import { create } from 'zustand'

import { DEFAULT_COMMAND, type Command } from '../navigation/registry.ts'

type RouterState = {
  command: Command
  goTo: (command: Command) => void
}

export const useRouterStore = create<RouterState>()((set) => ({
  command: DEFAULT_COMMAND,
  goTo: (command) => set({ command }),
}))
