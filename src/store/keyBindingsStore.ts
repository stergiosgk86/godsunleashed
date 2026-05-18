import { create } from 'zustand'
import { useAuthStore } from './authStore'

export type BindableAction = 'up' | 'down' | 'left' | 'right' | 'dash'

export interface KeyBindings {
  up: number
  down: number
  left: number
  right: number
  dash: number
  setBinding: (action: BindableAction, keyCode: number) => void
  reset: () => void
  loadFromServer: (saved: Record<string, number> | null | undefined) => void
}

export const DEFAULT_BINDINGS: Record<BindableAction, number> = {
  up: 87,    // W
  down: 83,  // S
  left: 65,  // A
  right: 68, // D
  dash: 32,  // Space
}

async function saveToServer(bindings: Record<BindableAction, number>) {
  const token = useAuthStore.getState().token
  if (!token) return
  await fetch('/api/key-bindings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bindings }),
  })
}

export const useKeyBindingsStore = create<KeyBindings>((set, get) => ({
  ...DEFAULT_BINDINGS,

  loadFromServer: (saved) => {
    if (!saved || Object.keys(saved).length === 0) return
    const merged = { ...DEFAULT_BINDINGS }
    for (const action of Object.keys(DEFAULT_BINDINGS) as BindableAction[]) {
      if (typeof saved[action] === 'number') merged[action] = saved[action]
    }
    set(merged)
  },

  setBinding: (action, keyCode) => {
    set({ [action]: keyCode })
    const { up, down, left, right, dash } = get()
    saveToServer({ up, down, left, right, dash })
  },

  reset: () => {
    set({ ...DEFAULT_BINDINGS })
    saveToServer({ ...DEFAULT_BINDINGS })
  },
}))

// Returns a human-readable label for a keyCode
export function keyCodeLabel(code: number): string {
  if (code === 32) return 'Space'
  if (code === 16) return 'Shift'
  if (code === 17) return 'Ctrl'
  if (code === 18) return 'Alt'
  if (code === 9)  return 'Tab'
  if (code === 13) return 'Enter'
  if (code === 8)  return 'Backspace'
  if (code === 46) return 'Delete'
  if (code === 45) return 'Insert'
  if (code === 36) return 'Home'
  if (code === 35) return 'End'
  if (code === 33) return 'PgUp'
  if (code === 34) return 'PgDn'
  if (code >= 112 && code <= 123) return `F${code - 111}`
  if (code >= 96 && code <= 105) return `Num${code - 96}`
  return String.fromCharCode(code)
}

const BLOCKED = new Set([27, 38, 40, 37, 39]) // Esc, arrows

export function isAllowedKeyCode(code: number): boolean {
  return !BLOCKED.has(code)
}
