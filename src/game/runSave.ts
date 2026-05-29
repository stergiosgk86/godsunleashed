import type { EnemySave } from './EnemySpawner'
import { useAuthStore } from '../store/authStore'

export interface RunSnapshot {
  // character that saved this run — used to reject cross-character restores
  character?: string
  stage?: 1 | 2
  // time
  elapsed: number
  nextBossAt: number
  warningFired: boolean
  finalBossWarningFired: boolean
  bossAlive: boolean
  finalBossAlive: boolean
  // player
  playerX: number
  playerY: number
  // enemies
  enemies: EnemySave[]
  // stats
  kills: number
  bossKills: number
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
  auraTick: number
  auraRange: number
  orbital: number
  wand: boolean
  boomerang: boolean
  flameTrail: boolean
  bloodNova: boolean
  bloodNovaCD?: number
  vampiric: boolean
  lightning: boolean
  lightningTargets: number
  lightningCooldown: number
  axe: boolean
  divineShield: boolean
  armor: number
  hpRegen: number
  lifeDrain: number
  sessionCoins: number
  xpGain?: number
  magnetRange?: number
  orbSpeed?: number
  orbPower?: number
  orbRange?: number
  equinox?: boolean
  solstice?: boolean
  dualGunDamage?: number
  dualGunSpeed?: number
  dualGunExtra?: number
  dualGunAttackInterval?: number
  echo?: number
  ravens?: boolean
  ravensCD?: number
  ravensPower?: number
  ravensCount?: number
}

function authHeader(): HeadersInit {
  const token = useAuthStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function saveRun(snap: RunSnapshot): void {
  const token = useAuthStore.getState().token
  if (!token) return
  fetch('/api/run-snapshot', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ snapshot: snap }),
    keepalive: true,  // survives page unload so beforeunload saves reach the server
  }).catch(() => {})
}

export async function loadRun(): Promise<RunSnapshot | null> {
  try {
    const r = await fetch('/api/run-snapshot', { headers: authHeader() })
    if (!r.ok) return null
    const data = await r.json() as { snapshot: RunSnapshot | null }
    return data.snapshot ?? null
  } catch {
    return null
  }
}

export function clearRun(): void {
  const token = useAuthStore.getState().token
  if (!token) return
  fetch('/api/run-snapshot', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}
