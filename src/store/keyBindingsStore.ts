import { create } from 'zustand'

export type BindableAction = 'up' | 'down' | 'left' | 'right' | 'dash'

export interface KeyBindings {
  up: number
  down: number
  left: number
  right: number
  dash: number
  setBinding: (action: BindableAction, keyCode: number) => void
  reset: () => void
}

export const DEFAULT_BINDINGS: Record<BindableAction, number> = {
  up: 87,    // W
  down: 83,  // S
  left: 65,  // A
  right: 68, // D
  dash: 32,  // Space
}

function load(): Record<BindableAction, number> {
  try {
    const raw = localStorage.getItem('key-bindings')
    if (raw) return { ...DEFAULT_BINDINGS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULT_BINDINGS }
}

function save(b: Record<BindableAction, number>) {
  localStorage.setItem('key-bindings', JSON.stringify(b))
}

const initial = load()

export const useKeyBindingsStore = create<KeyBindings>((set) => ({
  ...initial,
  setBinding: (action, keyCode) => set((s) => {
    const next = { up: s.up, down: s.down, left: s.left, right: s.right, dash: s.dash, [action]: keyCode }
    save(next)
    return { [action]: keyCode }
  }),
  reset: () => set(() => {
    save({ ...DEFAULT_BINDINGS })
    return { ...DEFAULT_BINDINGS }
  }),
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

// Keycodes that are not safe to rebind (would break the game/menu)
const BLOCKED = new Set([27, 38, 40, 37, 39]) // Esc, arrows

export function isAllowedKeyCode(code: number): boolean {
  return !BLOCKED.has(code)
}
