export interface ControlEntry {
  keys: string[]
  label: string
}

export const CONTROLS: ControlEntry[] = [
  { keys: ['W', 'A', 'S', 'D'],  label: 'Move' },
  { keys: ['↑', '←', '↓', '→'], label: 'Move (arrows)' },
  { keys: ['Space'],              label: 'Dash' },
  { keys: ['ESC'],                label: 'Pause / Resume' },
]
