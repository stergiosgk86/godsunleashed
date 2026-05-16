import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export const DASH_COOLDOWN_MS = 5000

export type UpgradeId = 'attackSpeed' | 'moveSpeed' | 'maxHp' | 'dashCooldown' | 'dashDistance' | 'multiShot' | 'piercing' | 'aura' | 'orbital'

export function weaponBaseDamage(level: number): number {
  return Math.floor(3 + level * 2)
}

export interface Upgrade {
  id: UpgradeId
  label: string
  description: string
}

const UPGRADE_POOL: Upgrade[] = [
  { id: 'attackSpeed', label: 'Faster Attacks',  description: '15% shorter attack cooldown' },
  { id: 'moveSpeed',   label: 'Move Faster',     description: '15% faster movement speed' },
  { id: 'maxHp',       label: '+25 Max HP',      description: 'Increase maximum health' },
  { id: 'dashCooldown',  label: 'Swift Dash',      description: '25% shorter dash cooldown' },
  { id: 'dashDistance',  label: 'Longer Dash',     description: '40% further dash distance' },
  { id: 'multiShot',     label: 'Multi Shot',      description: 'Fire an extra projectile per attack' },
  { id: 'piercing',      label: 'Piercing',        description: 'Shots pass through enemies' },
  { id: 'aura',          label: 'Aura',            description: 'Pulses damage to all enemies in range' },
  { id: 'orbital',      label: 'Spirit Orb',      description: 'An orb orbits you, damaging enemies on contact (+1 orb per pick, max 3)' },
]

function xpNeeded(level: number) {
  return Math.floor(5 * Math.pow(1.5, level - 1))
}

const DASH_IDS = new Set<UpgradeId>(['dashCooldown', 'dashDistance'])

function pickChoices(state: { piercing: boolean; multiShot: number; orbital: number }): Upgrade[] {
  const pool = UPGRADE_POOL.filter(u => {
    if (u.id === 'piercing' && state.piercing) return false
    if (u.id === 'multiShot' && state.multiShot >= 4) return false
    if (u.id === 'orbital' && state.orbital >= 3) return false
    return true
  })
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const choices = shuffled.slice(0, 3)
  const dashCount = choices.filter(u => DASH_IDS.has(u.id)).length
  if (dashCount > 1) {
    const dupIdx = choices.findLastIndex(u => DASH_IDS.has(u.id))
    const replacement = shuffled.find(u => !DASH_IDS.has(u.id) && !choices.includes(u))!
    choices[dupIdx] = replacement
  }
  return choices
}

interface GameState {
  xp: number
  xpNeeded: number
  level: number
  hp: number
  maxHp: number
  might: number
  attackInterval: number
  moveSpeed: number
  isLevelUpPending: boolean
  upgradeChoices: Upgrade[]
  invincibleUntil: number
  bossHp: number | null
  bossMaxHp: number
  isPaused: boolean
  dashCooldown: number
  dashCooldownUntil: number
  dashDistance: number
  multiShot: number
  piercing: boolean
  aura: number
  orbital: number
  sessionCoins: number
  isDead: boolean
  isWon: boolean
  hpRegen: number
  lifeDrain: number

  addXP: (amount: number) => void
  takeDamage: (amount: number) => void
  die: () => void
  win: () => void
  chooseUpgrade: (id: UpgradeId) => void
  setBossHp: (hp: number | null, maxHp?: number) => void
  togglePause: () => void
  startDash: () => boolean
  addSessionCoins: (amount: number) => void
  resetRun: () => void
}

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    xp: 0,
    xpNeeded: xpNeeded(1),
    level: 1,
    hp: 100,
    maxHp: 100,
    might: 1.0,
    attackInterval: 600,
    moveSpeed: 200,
    isLevelUpPending: false,
    upgradeChoices: [],
    invincibleUntil: 0,
    bossHp: null,
    bossMaxHp: 300,
    isPaused: false,
    dashCooldown: DASH_COOLDOWN_MS,
    dashCooldownUntil: 0,
    dashDistance: 1,
    multiShot: 0,
    piercing: false,
    aura: 0,
    orbital: 0,
    sessionCoins: 0,
    isDead: false,
    isWon: false,
    hpRegen: 0,
    lifeDrain: 0,

    addXP: (amount) => {
      set(s => {
        let { xp, xpNeeded: needed, level, isLevelUpPending } = s
        xp += amount
        if (xp >= needed && !isLevelUpPending) {
          return {
            xp: xp - needed,
            level: level + 1,
            xpNeeded: xpNeeded(level + 1),
            isLevelUpPending: true,
            upgradeChoices: pickChoices(s),
          }
        }
        return { xp }
      })
    },

    takeDamage: (amount) => {
      const { invincibleUntil, hp, isDead } = get()
      if (isDead || Date.now() < invincibleUntil) return
      set({ hp: Math.max(0, hp - amount), invincibleUntil: Date.now() + 1000 })
    },

    die: () => set({ isDead: true, isPaused: false }),
    win: () => set({ isWon: true, isPaused: false }),

    setBossHp: (hp, maxHp) => {
      set(s => ({ bossHp: hp, bossMaxHp: maxHp ?? s.bossMaxHp }))
    },

    togglePause: () => {
      set(s => {
        if (s.isLevelUpPending) return {}
        return { isPaused: !s.isPaused }
      })
    },

    startDash: () => {
      const { dashCooldownUntil, dashCooldown } = get()
      if (Date.now() < dashCooldownUntil) return false
      set({ dashCooldownUntil: Date.now() + dashCooldown })
      return true
    },

    addSessionCoins: (amount) => set(s => ({ sessionCoins: s.sessionCoins + amount })),

    resetRun: () => set({
      xp: 0, xpNeeded: xpNeeded(1), level: 1,
      hp: 100, maxHp: 100,
      might: 1.0, attackInterval: 600, moveSpeed: 200,
      isLevelUpPending: false, upgradeChoices: [],
      invincibleUntil: 0, bossHp: null, bossMaxHp: 300,
      isPaused: false, dashCooldown: DASH_COOLDOWN_MS, dashCooldownUntil: 0,
      dashDistance: 1, multiShot: 0, piercing: false, aura: 0, orbital: 0,
      sessionCoins: 0, isDead: false, isWon: false, hpRegen: 0, lifeDrain: 0,
    }),

    chooseUpgrade: (id) => {
      set(s => {
        switch (id) {
          case 'attackSpeed':
            return { attackInterval: Math.max(100, Math.floor(s.attackInterval * 0.85)), isLevelUpPending: false }
          case 'moveSpeed':
            return { moveSpeed: Math.floor(s.moveSpeed * 1.15), isLevelUpPending: false }
          case 'maxHp':
            return { maxHp: s.maxHp + 25, hp: Math.min(s.hp + 25, s.maxHp + 25), isLevelUpPending: false }
          case 'dashCooldown':
            return { dashCooldown: Math.max(400, Math.floor(s.dashCooldown * 0.75)), isLevelUpPending: false }
          case 'dashDistance':
            return { dashDistance: s.dashDistance + 0.4, isLevelUpPending: false }
          case 'multiShot':
            return { multiShot: s.multiShot + 1, isLevelUpPending: false }
          case 'piercing':
            return { piercing: true, isLevelUpPending: false }
          case 'aura':
            return { aura: s.aura + 1, isLevelUpPending: false }
          case 'orbital':
            return { orbital: s.orbital + 1, isLevelUpPending: false }
        }
      })
    },
  }))
)
