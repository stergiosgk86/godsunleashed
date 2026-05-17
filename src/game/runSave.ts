import type { EnemySave } from './EnemySpawner'

const KEY = 'gods_run'

export interface RunSnapshot {
  // time
  elapsed: number
  nextBossAt: number
  warningFired: boolean
  finalBossWarningFired: boolean
  // player
  playerX: number
  playerY: number
  // enemies
  enemies: EnemySave[]
  // gameStore
  xp: number
  xpNeeded: number
  level: number
  hp: number
  maxHp: number
  might: number
  attackInterval: number
  moveSpeed: number
  dashCooldown: number
  dashDistance: number
  multiShot: number
  piercing: boolean
  aura: number
  orbital: number
  boomerang: boolean
  flameTrail: boolean
  bloodNova: boolean
  vampiric: boolean
  hpRegen: number
  lifeDrain: number
  sessionCoins: number
}

export function saveRun(snap: RunSnapshot) {
  sessionStorage.setItem(KEY, JSON.stringify(snap))
}

export function loadRun(): RunSnapshot | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as RunSnapshot } catch { return null }
}

export function clearRun() {
  sessionStorage.removeItem(KEY)
}
