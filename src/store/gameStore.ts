import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { useCharacterStore } from './characterStore'

export const DASH_COOLDOWN_MS = 5000

export type UpgradeId = 'moveSpeed' | 'dashCooldown' | 'dashDistance' | 'multiShot' | 'piercing' | 'aura' | 'auraTick' | 'auraRange' | 'orbital' | 'boomerang' | 'flameTrail' | 'bloodNova' | 'vampiric' | 'lightning' | 'might' | 'axe' | 'divineShield'

export function weaponBaseDamage(_level: number): number {
  return 15
}

export interface Upgrade {
  id: UpgradeId
  label: string
  description: string
}

export const UPGRADE_POOL: Upgrade[] = [
  { id: 'dashCooldown',  label: 'Swift Dash',      description: '25% shorter dash cooldown' },
  { id: 'dashDistance',  label: 'Longer Dash',     description: '40% further dash distance' },
  { id: 'multiShot',     label: 'Multi Shot',      description: 'Fire an extra projectile per attack' },
  { id: 'piercing',      label: 'Piercing',        description: 'Shots pass through enemies' },
  { id: 'aura',          label: 'Aura',            description: 'Pulses damage to all enemies in range' },
  { id: 'auraTick',     label: 'Aura Tempo',      description: 'Aura pulses 250ms faster (stackable, up to 3×)' },
  { id: 'auraRange',    label: 'Aura Range',      description: 'Expands the aura radius (stackable, up to 3×)' },
  { id: 'orbital',      label: 'Spirit Orb',      description: 'An orb orbits you, damaging enemies on contact (+1 orb per pick, max 3)' },
  { id: 'boomerang',   label: 'Boomerang',        description: 'Throws a disc that flies out then returns, hitting enemies twice' },
  { id: 'flameTrail',  label: 'Flame Trail',      description: 'Leaves burning patches as you move that damage nearby enemies' },
  { id: 'bloodNova',   label: 'Blood Nova',       description: 'Every 7s releases a massive red ring — costs 8% of your max HP' },
  { id: 'vampiric',   label: 'Soul Drain',       description: 'Each hit restores 8% of damage dealt as HP' },
  { id: 'lightning',  label: 'Thunder Strike',   description: 'Every 4s lightning bolts strike 2 random enemies for heavy damage' },
  { id: 'might',     label: 'Power',            description: '+10% weapon damage (stackable, up to 5×)' },
  { id: 'axe',      label: 'War Axe',          description: 'Hurls a spinning axe in an arc — hits on the way up and again on the way down' },
  { id: 'divineShield', label: 'Divine Shield', description: 'Grants a shield that blocks the next hit. After absorbing a hit you are briefly immune, then the shield recharges in 7s' },
]

function xpNeeded(level: number) {
  // L1=10, L2=24, L3=42, L4=64, L5=90, L10=280, L15=570
  return Math.floor(level * (level + 4) * 2)
}

const DASH_IDS = new Set<UpgradeId>(['dashCooldown', 'dashDistance'])

function pickChoices(state: { piercing: boolean; multiShot: number; orbital: number; boomerang: boolean; flameTrail: boolean; bloodNova: boolean; vampiric: boolean; lightning: boolean; might: number; axe: boolean; aura: number; auraTick: number; auraRange: number; divineShield: boolean }): Upgrade[] {
  const isMelee = useCharacterStore.getState().selectedCharacter === 'ares'
  const pool = UPGRADE_POOL.filter(u => {
    if (isMelee && u.id === 'multiShot')               return false
    if (isMelee && u.id === 'piercing')                return false
    if (u.id === 'piercing'   && state.piercing)       return false
    if (u.id === 'multiShot'  && state.multiShot >= 4) return false
    if (u.id === 'orbital'    && state.orbital >= 3)   return false
    if (u.id === 'boomerang'  && state.boomerang)      return false
    if (u.id === 'flameTrail' && state.flameTrail)     return false
    if (u.id === 'bloodNova'  && state.bloodNova)      return false
    if (u.id === 'vampiric'   && state.vampiric)       return false
    if (u.id === 'lightning'  && state.lightning)      return false
    if (u.id === 'might'      && state.might >= 1.5)    return false
    if (u.id === 'axe'        && state.axe)            return false
    if (u.id === 'divineShield' && state.divineShield)  return false
    if (u.id === 'aura'       && state.aura >= 1)       return false
    if (u.id === 'auraTick'   && state.aura === 0)     return false
    if (u.id === 'auraTick'   && state.auraTick >= 3)  return false
    if (u.id === 'auraRange'  && state.aura === 0)     return false
    if (u.id === 'auraRange'  && state.auraRange >= 3) return false
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
  damageFlashUntil: number
  bossHp: number | null
  bossMaxHp: number
  bossInvulnerable: boolean
  isPaused: boolean
  dashCooldown: number
  dashCooldownUntil: number
  dashDistance: number
  multiShot: number
  piercing: boolean
  aura: number
  auraTick: number
  auraRange: number
  orbital: number
  boomerang: boolean
  flameTrail: boolean
  bloodNova: boolean
  vampiric: boolean
  lightning: boolean
  axe: boolean
  divineShield: boolean
  divineShieldActive: boolean
  armor: number
  sessionCoins: number
  isDead: boolean
  isWon: boolean
  hpRegen: number
  lifeDrain: number
  kills: number
  damageDealt: number
  bossKills: number
  tookDamageThisRun: boolean
  recentAchievement: { id: string; name: string } | null
  adminInvincible: boolean

  serverDrivenLeveling: boolean
  chosenUpgrade: UpgradeId | null
  setServerDrivenLeveling: (value: boolean) => void
  addXP: (amount: number) => void
  setAdminInvincible: (value: boolean) => void
  setDivineShield: (active: boolean) => void
  takeDamage: (amount: number) => void
  takeContactDamage: (amount: number) => void
  die: () => void
  win: () => void
  chooseUpgrade: (id: UpgradeId) => void
  setBossHp: (hp: number | null, maxHp?: number) => void
  setBossInvulnerable: (invuln: boolean) => void
  togglePause: () => void
  startDash: () => boolean
  addSessionCoins: (amount: number) => void
  healPlayer: (amount: number) => void
  addKill: () => void
  addDamage: (amount: number) => void
  addBossKill: () => void
  clearRecentAchievement: () => void
  resetRun: () => void
}

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    serverDrivenLeveling: false,
    chosenUpgrade: null,
    xp: 0,
    xpNeeded: xpNeeded(1),
    level: 1,
    hp: 100,
    maxHp: 100,
    might: 1.0,
    attackInterval: 500,
    moveSpeed: 200,
    isLevelUpPending: false,
    upgradeChoices: [],
    invincibleUntil: 0,
    damageFlashUntil: 0,
    bossHp: null,
    bossMaxHp: 300,
    bossInvulnerable: false,
    isPaused: false,
    dashCooldown: DASH_COOLDOWN_MS,
    dashCooldownUntil: 0,
    dashDistance: 1,
    multiShot: 0,
    piercing: false,
    aura: 0,
    auraTick: 0,
    auraRange: 0,
    orbital: 0,
    boomerang: false,
    flameTrail: false,
    bloodNova: false,
    vampiric: false,
    lightning: false,
    axe: false,
    divineShield: false,
    divineShieldActive: false,
    armor: 0,
    sessionCoins: 0,
    isDead: false,
    isWon: false,
    hpRegen: 0,
    lifeDrain: 0,
    kills: 0,
    damageDealt: 0,
    bossKills: 0,
    tookDamageThisRun: false,
    recentAchievement: null,
    adminInvincible: false,

    setServerDrivenLeveling: (value) => set({ serverDrivenLeveling: value }),

    addXP: (amount) => {
      set(s => {
        if (s.serverDrivenLeveling) {
          // Server drives level-ups in multiplayer; just fill the XP bar visually
          return { xp: Math.min(s.xp + amount, s.xpNeeded) }
        }
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

    setAdminInvincible: (value) => set({ adminInvincible: value }),
    setDivineShield: (active) => set({ divineShieldActive: active }),

    // Contact damage: per-enemy cooldowns in CombatSystem — no global invincibility here.
    takeContactDamage: (amount) => {
      const { hp, isDead, adminInvincible, armor, divineShieldActive } = get()
      if (isDead || adminInvincible) return
      if (divineShieldActive) {
        set({ divineShieldActive: false })
        return
      }
      const reduced = Math.max(1, amount - armor)
      set({ hp: Math.max(0, hp - reduced), damageFlashUntil: Date.now() + 200, tookDamageThisRun: true })
      if (get().hp <= 0) get().die()
    },

    takeDamage: (amount) => {
      const { invincibleUntil, hp, isDead, adminInvincible, armor, divineShieldActive } = get()
      if (isDead || adminInvincible) return
      if (divineShieldActive) {
        const now = Date.now()
        set({ divineShieldActive: false, invincibleUntil: now + 1000, damageFlashUntil: now + 300 })
        return
      }
      if (Date.now() < invincibleUntil) return
      const now = Date.now()
      const reduced = Math.max(1, amount - armor)
      set({ hp: Math.max(0, hp - reduced), invincibleUntil: now + 1000, damageFlashUntil: now + 1000, tookDamageThisRun: true })
    },

    die: () => set({ isDead: true, isPaused: false }),
    win: () => set({ isWon: true, isPaused: false }),

    setBossHp: (hp, maxHp) => {
      set(s => ({ bossHp: hp, bossMaxHp: maxHp ?? s.bossMaxHp }))
    },

    setBossInvulnerable: (invuln) => set({ bossInvulnerable: invuln }),

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

    healPlayer: (amount) => set(s => ({ hp: Math.min(s.maxHp, s.hp + amount) })),
    addSessionCoins: (amount) => set(s => ({ sessionCoins: s.sessionCoins + amount })),
    addKill: () => set(s => ({ kills: s.kills + 1 })),
    addDamage: (amount) => set(s => ({ damageDealt: s.damageDealt + amount })),
    addBossKill: () => set(s => ({ bossKills: s.bossKills + 1 })),
    clearRecentAchievement: () => set({ recentAchievement: null }),

    resetRun: () => set({
      chosenUpgrade: null,
      xp: 0, xpNeeded: xpNeeded(1), level: 1,
      hp: 100, maxHp: 100,
      might: 1.0, attackInterval: 500, moveSpeed: 200,
      isLevelUpPending: false, upgradeChoices: [],
      invincibleUntil: 0, damageFlashUntil: 0, bossHp: null, bossMaxHp: 300, bossInvulnerable: false,
      isPaused: false, dashCooldown: DASH_COOLDOWN_MS, dashCooldownUntil: 0,
      dashDistance: 1, multiShot: 0, piercing: false, aura: 0, auraTick: 0, auraRange: 0, orbital: 0,
      boomerang: false, flameTrail: false, bloodNova: false, vampiric: false, lightning: false, axe: false, divineShield: false, divineShieldActive: false, armor: 0,
      sessionCoins: 0, isDead: false, isWon: false, hpRegen: 0, lifeDrain: 0,
      kills: 0, damageDealt: 0, bossKills: 0, tookDamageThisRun: false, recentAchievement: null,
    }),

    chooseUpgrade: (id) => {
      set(s => {
        let upgrade: Partial<GameState>
        switch (id) {
          case 'moveSpeed':    upgrade = { moveSpeed: Math.min(300, Math.floor(s.moveSpeed * 1.15)) }; break
          case 'dashCooldown': upgrade = { dashCooldown: Math.max(400, Math.floor(s.dashCooldown * 0.75)) }; break
          case 'dashDistance': upgrade = { dashDistance: s.dashDistance + 0.4 }; break
          case 'multiShot':    upgrade = { multiShot: s.multiShot + 1 }; break
          case 'piercing':     upgrade = { piercing: true }; break
          case 'aura':         upgrade = { aura: s.aura + 1 }; break
          case 'auraTick':     upgrade = { auraTick: s.auraTick + 1 }; break
          case 'auraRange':    upgrade = { auraRange: Math.min(3, s.auraRange + 1) }; break
          case 'orbital':      upgrade = { orbital: s.orbital + 1 }; break
          case 'boomerang':    upgrade = { boomerang: true }; break
          case 'flameTrail':   upgrade = { flameTrail: true }; break
          case 'bloodNova':    upgrade = { bloodNova: true }; break
          case 'vampiric':     upgrade = { vampiric: true }; break
          case 'lightning':    upgrade = { lightning: true }; break
          case 'axe':          upgrade = { axe: true }; break
          case 'divineShield': upgrade = { divineShield: true }; break
          case 'might':        upgrade = { might: Math.min(1.5, s.might + 0.1) }; break
          default:             upgrade = {}
        }
        return { ...upgrade, isLevelUpPending: false, chosenUpgrade: id }
      })
    },
  }))
)

// Read-time clamping: prevents browser-console setState() abuse in solo mode.
// All combat-hot-path code should destructure from this instead of getState().
export function getValidatedCombatState() {
  const s = useGameStore.getState()
  return {
    ...s,
    might:          Math.min(2.0, Math.max(1.0, s.might)),
    attackInterval: Math.max(250, s.attackInterval),
    multiShot:      Math.min(4, Math.max(0, Math.floor(s.multiShot))),
    aura:           Math.min(1, Math.max(0, Math.floor(s.aura))),
    auraTick:       Math.min(3, Math.max(0, Math.floor(s.auraTick))),
    auraRange:      Math.min(3, Math.max(0, Math.floor(s.auraRange))),
    orbital:        Math.min(3, Math.max(0, Math.floor(s.orbital))),
    moveSpeed:      Math.min(300, Math.max(50, s.moveSpeed)),
  }
}
