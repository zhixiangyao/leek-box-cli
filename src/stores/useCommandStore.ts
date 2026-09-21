import { create } from 'zustand'

import { type Command, DEFAULT_COMMAND } from '../navigation/registry.ts'

type CommandState = {
  command: Command
  setCommand: (command: Command) => void
}

export const useCommandStore = create<CommandState>()((set) => ({
  command: DEFAULT_COMMAND,
  setCommand: (command) => set({ command }),
}))
