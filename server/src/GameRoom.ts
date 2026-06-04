import type { WebSocket } from 'ws'
import { ServerSpawner } from './ServerSpawner.js'
import type { S2CMessage, PlayerSnapshot } from './protocol.js'
import type { PlayerRunData } from './runSaver.js'

// ─── RUN OBSERVER (temporary, remove after analysis) ────────────────────────
function obs(tag: string, msg: string) {
  const t = new Date().toISOString().slice(11, 19)
  console.log(`[OBS ${t}] [${tag}] ${msg}`)
}
// ─────────────────────────────────────────────────────────────────────────────

const TICK_MS = 50
const MAX_PLAYERS = 4
const MAX_DAMAGE_FALLBACK = 200  // used before player upgrades are known
const MAX_COORD   = 600_000 // matches ±500 000 physics bounds with some margin
const MAX_VEL     = 2_000   // max projectile velocity component

// All upgrade IDs the server knows about (mirrors client UPGRADE_POOL)
const ALL_UPGRADE_IDS = [
  'dashCooldown', 'dashDistance', 'wand', 'multiShot', 'piercing',
  'aura', 'auraTick', 'auraRange', 'orbital', 'orbSpeed', 'orbPower', 'orbRange',
  'boomerang', 'flameTrail', 'bloodNova', 'bloodNovaCD', 'vampiric',
  'lightning', 'lightningTargets', 'lightningCooldown', 'might',
  'axe', 'axeAmount', 'axeDamage', 'axePierce', 'axeEvolution',
  'divineShield',
  'xpGain', 'magnetRange',
  'equinox', 'solstice', 'dualGunDamage', 'dualGunSpeed', 'dualGunExtra',
  'echo',
  'ravens', 'ravensCD', 'ravensPower', 'ravensCount',
  'spear', 'spearCount', 'spearInterval', 'spearPierce', 'spearSpeed', 'spearStorm',
  'meleeRange', 'meleeSpeed', 'meleeDamage', 'meleeArcWidth',
] as const
type UpgradeId = typeof ALL_UPGRADE_IDS[number]
const VALID_UPGRADE_SET = new Set<string>(ALL_UPGRADE_IDS)
// Weapon families — at most one member per offer (VS-style structural cap)
const WEAPON_FAMILIES: Record<string, readonly string[]> = {
  wand:      ['multiShot', 'piercing'],
  aura:      ['auraTick', 'auraRange'],
  orbital:   ['orbSpeed', 'orbPower', 'orbRange'],
  lightning: ['lightningTargets', 'lightningCooldown'],
  bloodNova: ['bloodNovaCD'],
  ravens:    ['ravensCD', 'ravensPower', 'ravensCount'],
  axe:       ['axeAmount', 'axeDamage', 'axePierce', 'axeEvolution'],
  spear:     ['spearCount', 'spearInterval', 'spearPierce'],
  dash:      ['dashCooldown', 'dashDistance'],
  dualGun:   ['dualGunDamage', 'dualGunSpeed', 'dualGunExtra'],
  melee:     ['meleeRange', 'meleeSpeed', 'meleeDamage', 'meleeArcWidth'],
}
const UPGRADE_FAMILY: Record<string, string> = {}
for (const [family, ids] of Object.entries(WEAPON_FAMILIES)) {
  for (const id of ids) UPGRADE_FAMILY[id] = family
}

const BASE_WEAPONS = new Set<string>([
  'wand', 'aura', 'orbital', 'boomerang', 'flameTrail',
  'bloodNova', 'lightning', 'axe', 'equinox', 'solstice', 'ravens', 'spear',
])
const WEAPON_CAP = 6

// Maps each upgrade ID to its unlock group key. Upgrades not listed here are always available.
const UPGRADE_TO_WEAPON_GROUP: Partial<Record<string, string>> = {
  orbital: 'orbital', orbSpeed: 'orbital', orbPower: 'orbital', orbRange: 'orbital',
  boomerang: 'boomerang',
  flameTrail: 'flameTrail',
  bloodNova: 'bloodNova', bloodNovaCD: 'bloodNova',
  lightning: 'lightning', lightningTargets: 'lightning', lightningCooldown: 'lightning',
  axe: 'axe', axeAmount: 'axe', axeDamage: 'axe', axePierce: 'axe', axeEvolution: 'axe',
  aura: 'aura', auraTick: 'aura', auraRange: 'aura',
  equinox: 'equinox', solstice: 'equinox', dualGunDamage: 'equinox', dualGunSpeed: 'equinox', dualGunExtra: 'equinox',
  ravens: 'ravens', ravensCD: 'ravens', ravensPower: 'ravens', ravensCount: 'ravens',
  spear: 'spear', spearCount: 'spear', spearInterval: 'spear', spearPierce: 'spear', spearSpeed: 'spear', spearStorm: 'spear',
  vampiric: 'vampiric',
  divineShield: 'divineShield',
  echo: 'echo',
}

function playerOwnsGroup(group: string, u: PlayerUpgrades): boolean {
  switch (group) {
    case 'orbital':      return u.orbital > 0
    case 'boomerang':    return u.boomerang
    case 'flameTrail':   return u.flameTrail
    case 'bloodNova':    return u.bloodNova
    case 'lightning':    return u.lightning
    case 'axe':          return u.axe
    case 'aura':         return u.aura
    case 'equinox':      return u.equinox || u.solstice
    case 'ravens':       return u.ravens
    case 'spear':        return u.spear
    case 'vampiric':     return u.vampiric
    case 'divineShield': return u.divineShield
    case 'echo':         return u.echo > 0
    default:             return true
  }
}

function countOwnedWeapons(u: PlayerUpgrades): number {
  return [
    u.wand, u.aura, u.orbital > 0, u.boomerang, u.flameTrail,
    u.bloodNova, u.lightning, u.axe, u.equinox, u.solstice, u.ravens, u.spear,
  ].filter(Boolean).length
}

// VS-inspired 3-tier curve. Mirrors client xpNeeded in gameStore.ts.
// T1 (L1–19): base 35, +40/level. T2 (L21–39): base 835, +55/level. T3 (L41+): base 1990, +75/level.
// Hard gates at L20 (+1000) and L40 (+3000).
function xpNeeded(level: number): number {
  if (level <= 20) {
    const base = 35 + (level - 1) * 40
    return level === 20 ? base + 1000 : base
  }
  if (level <= 40) {
    const base = 860 + (level - 21) * 55
    return level === 40 ? base + 3000 : base
  }
  return 2015 + (level - 41) * 75
}

interface PlayerUpgrades {
  wand: boolean
  piercing: boolean
  multiShot: number   // 0–4
  orbital: number     // 0–5
  orbSpeed: number    // 0–3
  orbPower: number    // 0–3
  orbRange: number    // 0–2
  boomerang: boolean
  flameTrail: boolean
  bloodNova: boolean
  bloodNovaCD: number  // 0–4, each -10s cooldown
  vampiric: boolean
  lightning: boolean
  lightningTargets: number  // 0–2
  lightningCooldown: number // 0–2
  mightPicks: number  // 0–5
  axe: boolean
  aura: boolean
  auraTick: number    // 0–3
  auraRange: number   // 0–3
  divineShield: boolean
  xpGain: number      // 0–5, each +8% XP
  magnetRange: number // 0–3
  dashCooldownPicks: number // 0–4, client-only stat but tracked for cap
  dashDistancePicks: number // 0–3, client-only stat but tracked for cap
  equinox: boolean
  solstice: boolean
  dualGunDamage: number  // 0–3
  dualGunSpeed: number   // 0–2
  dualGunExtra: number   // 0–2
  echo: number           // 0–2
  ravens: boolean
  ravensCD: number       // 0–3, each -500ms cooldown
  ravensPower: number    // 0–3, each +20% damage
  ravensCount: number    // 0–2, each +2 feathers per set
  spear: boolean
  spearCount: number     // 0–5, each +1 spear per burst
  spearInterval: number  // 0–3, each tighter burst + shorter cooldown
  spearPierce: number    // 0–2, base 3 pierce + 1 per level
  spearSpeed: number     // 0–5, each +10% projectile speed (Bracer)
  spearStorm: boolean    // Thousand Spears evolution
  axeAmount: number      // 0–2, +1 axe per throw (stackable ×2)
  axeDamage: number      // 0–1, +50% damage
  axePierce: number      // 0–1, +50% hit radius
  axeEvolution: boolean  // Death Spiral
  meleeRange: number     // 0–4, each +25% range
  meleeArc: number       // 0–1, adds rear strike 100ms after front
  meleeSpeed: number     // 0–4, each -15% attack interval
  meleeDamage: number    // 0–4, each +20% melee damage
  meleeArcWidth: number  // 0–3, each +20° arc width (base 90°)
  isMeleeChar: boolean   // admin-granted Blade of Ares on non-Ares characters
}

function emptyUpgrades(): PlayerUpgrades {
  return {
    wand: false, piercing: false, multiShot: 0, orbital: 0, orbSpeed: 0, orbPower: 0, orbRange: 0,
    boomerang: false, flameTrail: false, bloodNova: false, bloodNovaCD: 0,
    vampiric: false, lightning: false, lightningTargets: 0, lightningCooldown: 0, mightPicks: 0,
    axe: false, aura: false, auraTick: 0, auraRange: 0, divineShield: false, xpGain: 0, magnetRange: 0,
    dashCooldownPicks: 0, dashDistancePicks: 0,
    equinox: false, solstice: false, dualGunDamage: 0, dualGunSpeed: 0, dualGunExtra: 0, echo: 0,
    ravens: false, ravensCD: 0, ravensPower: 0, ravensCount: 0,
    spear: false, spearCount: 0, spearInterval: 0, spearPierce: 0, spearSpeed: 0, spearStorm: false,
    axeAmount: 0, axeDamage: 0, axePierce: 0, axeEvolution: false,
    meleeRange: 0, meleeArc: 0, meleeSpeed: 0, meleeDamage: 0, meleeArcWidth: 0, isMeleeChar: false,
  }
}

// Characters that start the run with a weapon already unlocked.
// These are pre-set so those weapons are never offered as level-up choices.
function startingUpgrades(characterType: string): Partial<PlayerUpgrades> {
  if (characterType === 'zeus')     return { lightning: true }
  if (characterType === 'freyja')   return { boomerang: true }
if (characterType === 'apollo')   return { wand: true }
  if (characterType === 'hades')    return { aura: true }
  if (characterType === 'chronos')  return { equinox: true, solstice: true }
  if (characterType === 'odin')     return { ravens: true }
  if (characterType === 'heimdall') return { spear: true }
  if (characterType === 'ares')    return { meleeArc: 1 }
  if (characterType === 'thor')    return { axe: true }
  return {}
}

function pickUpgradeChoices(u: PlayerUpgrades, isMelee: boolean, unlockedWeapons: Set<string>): string[] {
  const atWeaponCap = countOwnedWeapons(u) >= WEAPON_CAP

  const eligible = ALL_UPGRADE_IDS.filter(id => {
    // Weapon unlock gate: only offer weapons the player has unlocked
    // (unless they already own it via starting equipment)
    const group = UPGRADE_TO_WEAPON_GROUP[id]
    if (group && !playerOwnsGroup(group, u) && !unlockedWeapons.has(group)) return false

    // At weapon cap, stop offering new base weapons — only upgrades for owned weapons remain
    if (atWeaponCap && BASE_WEAPONS.has(id)) return false
    if (isMelee && (id === 'multiShot' || id === 'piercing')) return false
    if (id === 'wand'        && u.wand)              return false
    if (id === 'multiShot'   && !u.wand)             return false
    if (id === 'multiShot'   && u.multiShot >= 4)    return false
    if (id === 'piercing'    && !u.wand)             return false
    if (id === 'piercing'    && u.piercing)          return false
    if (id === 'orbital'     && u.orbital >= 5)      return false
    if (id === 'orbSpeed'    && u.orbital === 0)     return false
    if (id === 'orbSpeed'    && u.orbSpeed >= 3)     return false
    if (id === 'orbPower'    && u.orbital === 0)     return false
    if (id === 'orbPower'    && u.orbPower >= 3)     return false
    if (id === 'orbRange'    && u.orbital === 0)     return false
    if (id === 'orbRange'    && u.orbRange >= 2)     return false
    if (id === 'boomerang'   && u.boomerang)         return false
    if (id === 'flameTrail'  && u.flameTrail)        return false
    if (id === 'bloodNova'    && u.bloodNova)              return false
    if (id === 'bloodNovaCD'  && !u.bloodNova)             return false
    if (id === 'bloodNovaCD'  && u.bloodNovaCD >= 4)       return false
    if (id === 'vampiric'    && u.vampiric)          return false
    if (id === 'lightning'         && u.lightning)                   return false
    if (id === 'lightningTargets'  && !u.lightning)                  return false
    if (id === 'lightningTargets'  && u.lightningTargets >= 2)       return false
    if (id === 'lightningCooldown' && !u.lightning)                  return false
    if (id === 'lightningCooldown' && u.lightningCooldown >= 2)      return false
    if (id === 'might'       && u.mightPicks >= 5)   return false
    if (id === 'axe'          && u.axe)                        return false
    if (id === 'axeAmount'    && !u.axe)                       return false
    if (id === 'axeAmount'    && u.axeAmount >= 2)             return false
    if (id === 'axeDamage'    && !u.axe)                       return false
    if (id === 'axeDamage'    && u.axeDamage >= 1)             return false
    if (id === 'axePierce'    && !u.axe)                       return false
    if (id === 'axePierce'    && u.axePierce >= 1)             return false
    if (id === 'axeEvolution' && !u.axe)                       return false
    if (id === 'axeEvolution' && u.axeAmount < 1)              return false
    if (id === 'axeEvolution' && u.axeDamage < 1)              return false
    if (id === 'axeEvolution' && u.axePierce < 1)              return false
    if (id === 'axeEvolution' && u.axeEvolution)               return false
    if (id === 'divineShield'&& u.divineShield)      return false
    if (id === 'xpGain'      && u.xpGain >= 5)      return false
    if (id === 'magnetRange'    && u.magnetRange >= 3)       return false
    if (id === 'dashCooldown'   && u.dashCooldownPicks >= 4) return false
    if (id === 'dashDistance'   && u.dashDistancePicks >= 3) return false
    if (id === 'aura'        && u.aura)              return false
    if (id === 'auraTick'    && !u.aura)             return false
    if (id === 'auraTick'    && u.auraTick >= 3)     return false
    if (id === 'auraRange'   && !u.aura)             return false
    if (id === 'auraRange'   && u.auraRange >= 3)    return false
    if (id === 'equinox'       && u.equinox)                          return false
    if (id === 'solstice'      && u.solstice)                         return false
    if (id === 'dualGunDamage' && !u.equinox && !u.solstice)         return false
    if (id === 'dualGunDamage' && u.dualGunDamage >= 3)              return false
    if (id === 'dualGunSpeed'  && !u.equinox && !u.solstice)         return false
    if (id === 'dualGunSpeed'  && u.dualGunSpeed >= 2)               return false
    if (id === 'dualGunExtra'  && !u.equinox && !u.solstice)         return false
    if (id === 'dualGunExtra'  && u.dualGunExtra >= 2)               return false
    if (id === 'echo'          && u.echo >= 2)                        return false
    if (id === 'ravens'       && u.ravens)              return false
    if (id === 'ravensCD'     && !u.ravens)             return false
    if (id === 'ravensCD'     && u.ravensCD >= 3)       return false
    if (id === 'ravensPower'  && !u.ravens)             return false
    if (id === 'ravensPower'  && u.ravensPower >= 3)    return false
    if (id === 'ravensCount'  && !u.ravens)             return false
    if (id === 'ravensCount'  && u.ravensCount >= 2)    return false
    if (id === 'spear'          && u.spear)                    return false
    if (id === 'spearCount'     && !u.spear)                   return false
    if (id === 'spearCount'     && u.spearCount >= 5)          return false
    if (id === 'spearInterval'  && !u.spear)                   return false
    if (id === 'spearInterval'  && u.spearInterval >= 3)       return false
    if (id === 'spearPierce'    && !u.spear)                   return false
    if (id === 'spearPierce'    && u.spearPierce >= 2)         return false
    if (id === 'spearSpeed'     && !u.spear)                   return false
    if (id === 'spearSpeed'     && u.spearSpeed >= 5)          return false
    if (id === 'spearStorm'     && !unlockedWeapons.has('spearStorm')) return false
    if (id === 'spearStorm'     && !u.spear)                   return false
    if (id === 'spearStorm'     && u.spearCount < 5)           return false
    if (id === 'spearStorm'     && u.spearSpeed < 3)           return false
    if (id === 'spearStorm'     && u.spearStorm)               return false
    if (id === 'axeEvolution'   && !unlockedWeapons.has('axeEvolution')) return false
    if ((id === 'meleeRange' || id === 'meleeSpeed' || id === 'meleeDamage' || id === 'meleeArcWidth') && !isMelee && !u.isMeleeChar) return false
    if (id === 'meleeRange'     && u.meleeRange >= 4)          return false
    if (id === 'meleeSpeed'     && u.meleeSpeed >= 4)          return false
    if (id === 'meleeDamage'    && u.meleeDamage >= 4)         return false
    if (id === 'meleeArcWidth'  && u.meleeArcWidth >= 3)       return false
    return true
  })

  // Uniform random draw without replacement — VS-style: at most one upgrade per weapon family per offer
  const remaining = [...eligible]
  const choices: string[] = []
  for (let pick = 0; pick < 3 && remaining.length > 0; pick++) {
    const idx = Math.floor(Math.random() * remaining.length)
    const chosen = remaining[idx]
    choices.push(chosen)
    remaining.splice(idx, 1)
    // Remove siblings from the same weapon family so they can't appear in this offer
    const family = UPGRADE_FAMILY[chosen]
    if (family) {
      const siblings = new Set(WEAPON_FAMILIES[family])
      for (let j = remaining.length - 1; j >= 0; j--) {
        if (siblings.has(remaining[j])) remaining.splice(j, 1)
      }
    }
  }
  return choices
}

// Per-player coin drop rate (2% per kill, no luck rank knowledge server-side)
const COIN_DROP_CHANCE = 0.02

// ── Brazier (Divine Brazier) system ──────────────────────────────────────────
const BRAZIER_HP            = 12
const BRAZIER_CAP           = 8
const BRAZIER_SPAWN_MS      = 2000   // check every 2 s
const BRAZIER_SPAWN_CHANCE  = 0.15   // 15% per check

type BrazierDrop = 'coin' | 'coinBag' | 'hp' | 'xp' | 'magnet' | 'freeze' | 'divineWrath' | 'rerollDie'
interface ServerBrazier { id: number; x: number; y: number; hp: number; spawnedAt: number }

function rollBrazierDrop(): BrazierDrop {
  // VS-style weights: coin=49 hp=12 coinBag=10 xp=8 magnet=2 freeze=2 divineWrath=1 rerollDie=1 (total 85)
  const r = Math.random() * 85
  if (r < 49) return 'coin'
  if (r < 61) return 'hp'
  if (r < 71) return 'coinBag'
  if (r < 79) return 'xp'
  if (r < 81) return 'magnet'
  if (r < 83) return 'freeze'
  if (r < 84) return 'divineWrath'
  return 'rerollDie'
}

interface Player {
  id: string
  userId: number
  ws: WebSocket
  x: number
  y: number
  viewW: number
  viewH: number
  characterType: string
  username: string
  dead: boolean
  paused: boolean
  isHost: boolean
  aura: number
  orbital: number
  // Server-authoritative XP/leveling
  xp: number
  level: number
  pendingChoices: string[] | null  // non-null while waiting for chooseUpgrade
  pendingRawXP: number             // XP collected while upgrade screen is open; applied on chooseUpgrade
  rerollsLeft: number
  upgrades: PlayerUpgrades
  unlockedWeapons: Set<string>
  // Server-tracked run stats
  kills: number
  bossKills: number
  coins: number
  damageDealt: number
}

export class GameRoom {
  private players: Player[] = []
  private spawner = new ServerSpawner()
  private interval: ReturnType<typeof setInterval> | null = null
  private bosses = new Map<number, number>()  // id → maxHp
  private started = false
  private finished = false
  private startMs = 0
  private readonly isSolo: boolean
  private resumeElapsed = 0

  private braziers = new Map<number, ServerBrazier>()
  private brazierIdCtr = 0
  private brazierSpawnTimer = 0

  // Called once when the game ends (won or all dead). Set by the room creator.
  onGameEnd?: (results: PlayerRunData[]) => void

  constructor(isSolo = false) { this.isSolo = isSolo }

  addPlayer(id: string, userId: number, ws: WebSocket, characterType: string, username: string, x: number, y: number, viewW = 1280, viewH = 720, resumeLevel = 1, resumeXp = 0, resumeElapsed = 0, stage = 1, unlockedWeapons: string[] = [], rerollRank = 0) {
    if (this.started) return
    const isHost = this.players.length === 0
    this.players.push({
      id, userId, ws, x, y, viewW, viewH, characterType, username, dead: false, paused: false, isHost, aura: 0, orbital: 0,
      xp: resumeXp, level: resumeLevel, pendingChoices: null, pendingRawXP: 0, rerollsLeft: Math.min(rerollRank, 5), upgrades: { ...emptyUpgrades(), ...startingUpgrades(characterType) },
      unlockedWeapons: new Set(unlockedWeapons),
      kills: 0, bossKills: 0, coins: 0, damageDealt: 0,
    })
    if (this.isSolo && resumeElapsed > 0) this.resumeElapsed = resumeElapsed
    if (stage !== 1) {
      this.spawner.stage2Mode = true
      this.spawner.corridorHalfY = 380
    }
    this.broadcastWaiting()
    if (this.players.length >= MAX_PLAYERS || this.isSolo) {
      this.startGame()
    }
  }

  handleStartGame(requesterId: string): boolean {
    const requester = this.players.find(p => p.id === requesterId)
    if (!requester?.isHost || this.players.length < 2 || this.started) return false
    this.startGame()
    return true
  }

  private broadcastWaiting() {
    for (const p of this.players) {
      this.send(p.ws, { type: 'waiting', playerCount: this.players.length, isHost: p.isHost })
    }
  }

  private startGame() {
    if (this.started) return
    if (this.resumeElapsed > 0) this.spawner.resumeFrom(this.resumeElapsed)
    const snaps = this.playerSnapshots()
    for (const p of this.players) {
      this.send(p.ws, { type: 'start', yourId: p.id, players: snaps })
      obs('START', `${p.username} as ${p.characterType} | Lv${p.level} ${p.xp}xp | ${this.isSolo ? 'solo' : 'multi'}`)
    }
    this.startLoop()
  }

  pausePlayer(id: string) {
    const p = this.players.find(p => p.id === id)
    if (!p || p.dead) return
    p.paused = true
    if (this.isSolo && this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  resumePlayer(id: string) {
    const p = this.players.find(p => p.id === id)
    if (!p) return
    p.paused = false
    if (this.isSolo && this.started && !this.finished && !this.interval) {
      this.interval = setInterval(() => this.tick(), TICK_MS)
    }
  }

  updatePlayerPos(id: string, x: number, y: number, aura: number, orbital: number) {
    if (!isFinite(x) || !isFinite(y) || Math.abs(x) > MAX_COORD || Math.abs(y) > MAX_COORD) return
    const p = this.players.find(p => p.id === id)
    if (p && !p.dead) {
      p.x = x; p.y = y
      p.aura    = Math.max(0, Math.min(10, Math.floor(aura)))
      p.orbital = Math.max(0, Math.min(10, Math.floor(orbital)))
    }
  }

  markPlayerDead(id: string) {
    const p = this.players.find(p => p.id === id)
    if (p) p.dead = true
    if (this.isSolo && this.players.every(p => p.dead)) {
      this.finishGame(false)
    }
  }

  relayProjectile(fromId: string, x: number, y: number, vx: number, vy: number) {
    if (!isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy)
        || Math.abs(vx) > MAX_VEL || Math.abs(vy) > MAX_VEL) return
    const data = JSON.stringify({ type: 'projectile', playerId: fromId, x, y, vx, vy })
    for (const p of this.players) {
      if (p.id !== fromId && p.ws.readyState === 1) p.ws.send(data)
    }
  }

  handleHit(playerId: string, enemyId: number, damage: number) {
    if (!Number.isInteger(enemyId) || enemyId < 0 || !isFinite(damage) || damage <= 0) return
    const player = this.players.find(p => p.id === playerId)
    const cap = player ? this.maxHitDamage(player) : MAX_DAMAGE_FALLBACK
    const safeDamage = Math.min(Math.floor(damage), cap)
    const enemy = this.spawner.findById(enemyId)
    if (!enemy || !enemy.active) return

    if (player) player.damageDealt += safeDamage

    const died = enemy.takeDamage(safeDamage)
    if (died) {
      obs('KILL', `${enemy.kind} maxHp=${enemy.maxHp} | xp=${enemy.xpValue} | killer Lv${player?.level ?? '?'} kills=${player?.kills ?? '?'} | elapsed=${Math.round((this.spawner.runElapsed||0)/1000)}s`)
      this.broadcast({ type: 'enemyDied', enemyId, x: enemy.x, y: enemy.y, xpValue: enemy.xpValue })
      if (enemy.isBoss) this.broadcast({ type: 'bossHp', bossId: enemyId, hp: 0 })
      if (player) {
        player.kills++
        if (enemy.isBoss) {
          player.bossKills++
          player.coins += 4 + Math.floor(Math.random() * 5)  // bosses always drop coins
        } else if (Math.random() < COIN_DROP_CHANCE) {
          player.coins++
        }
      }
    } else if (enemy.isBoss) {
      this.broadcast({ type: 'bossHp', bossId: enemyId, hp: enemy.hp })
    }
  }

  handleAuraHit(playerId: string, enemyId: number, damage: number) {
    if (!Number.isInteger(enemyId) || enemyId < 0 || !isFinite(damage) || damage <= 0) return
    const player = this.players.find(p => p.id === playerId)
    const cap = player ? this.maxHitDamage(player) : MAX_DAMAGE_FALLBACK
    const safeDamage = Math.min(Math.floor(damage), cap)
    const enemy = this.spawner.findById(enemyId)
    if (!enemy || !enemy.active) return

    if (player) player.damageDealt += safeDamage

    const died = enemy.takeDamage(safeDamage)
    if (died) {
      this.broadcast({ type: 'enemyDied', enemyId, x: enemy.x, y: enemy.y, xpValue: enemy.xpValue })
      if (enemy.isBoss) this.broadcast({ type: 'bossHp', bossId: enemyId, hp: 0 })
      if (player) {
        player.kills++
        if (enemy.isBoss) {
          player.bossKills++
          player.coins += 4 + Math.floor(Math.random() * 5)
        } else if (Math.random() < COIN_DROP_CHANCE) {
          player.coins++
        }
      }
    } else {
      // Enemy survived: one-time knockback using server-stored player position
      if (player) {
        const dx = enemy.x - player.x
        const dy = enemy.y - player.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        enemy.x += (dx / dist) * 12
        enemy.y += (dy / dist) * 12
      }
      if (enemy.isBoss) this.broadcast({ type: 'bossHp', bossId: enemyId, hp: enemy.hp })
    }
  }

  // Max legitimate per-hit damage based on server-tracked might upgrades.
  // Blood Nova is the highest multiplier (30×); cap uses approx level-60 base damage (50) + 1.5× safety buffer.
  private maxHitDamage(p: Player): number {
    const mightMult = 1.0 + p.upgrades.mightPicks * 0.1
    return Math.ceil(50 * mightMult * 30 * 1.5)
  }

  handleChooseUpgrade(playerId: string, upgradeId: string) {
    if (!VALID_UPGRADE_SET.has(upgradeId)) return
    const p = this.players.find(p => p.id === playerId)
    if (!p || !p.pendingChoices || !p.pendingChoices.includes(upgradeId)) return

    p.pendingChoices = null
    const queuedXP = p.pendingRawXP
    p.pendingRawXP = 0

    const u = p.upgrades
    switch (upgradeId as UpgradeId) {
      case 'wand':        u.wand = true; break
      case 'piercing':    u.piercing = true; break
      case 'multiShot':   u.multiShot = Math.min(4, u.multiShot + 1); break
      case 'orbital':     u.orbital = Math.min(5, u.orbital + 1); p.orbital = u.orbital; break
      case 'orbSpeed':    u.orbSpeed = Math.min(3, u.orbSpeed + 1); break
      case 'orbPower':    u.orbPower = Math.min(3, u.orbPower + 1); break
      case 'orbRange':    u.orbRange = Math.min(2, u.orbRange + 1); break
      case 'boomerang':   u.boomerang = true; break
      case 'flameTrail':  u.flameTrail = true; break
      case 'bloodNova':    u.bloodNova = true; break
      case 'bloodNovaCD':  u.bloodNovaCD = Math.min(4, u.bloodNovaCD + 1); break
      case 'vampiric':    u.vampiric = true; break
      case 'lightning':         u.lightning = true; break
      case 'lightningTargets':  u.lightningTargets = Math.min(2, u.lightningTargets + 1); break
      case 'lightningCooldown': u.lightningCooldown = Math.min(2, u.lightningCooldown + 1); break
      case 'might':       u.mightPicks = Math.min(5, u.mightPicks + 1); break
      case 'axe':         u.axe = true; break
      case 'axeAmount':   u.axeAmount = Math.min(2, u.axeAmount + 1); break
      case 'axeDamage':   u.axeDamage = Math.min(1, u.axeDamage + 1); break
      case 'axePierce':   u.axePierce = Math.min(1, u.axePierce + 1); break
      case 'axeEvolution':u.axeEvolution = true; break
      case 'aura':        u.aura = true; p.aura = 1; break
      case 'auraTick':    u.auraTick = Math.min(3, u.auraTick + 1); break
      case 'auraRange':   u.auraRange = Math.min(3, u.auraRange + 1); break
      case 'equinox':      u.equinox = true; break
      case 'solstice':     u.solstice = true; break
      case 'dualGunDamage':u.dualGunDamage = Math.min(3, u.dualGunDamage + 1); break
      case 'dualGunSpeed': u.dualGunSpeed = Math.min(2, u.dualGunSpeed + 1); break
      case 'dualGunExtra': u.dualGunExtra = Math.min(2, u.dualGunExtra + 1); break
      case 'echo':         u.echo = Math.min(2, u.echo + 1); break
      case 'divineShield':u.divineShield = true; break
      case 'ravens':       u.ravens = true; break
      case 'ravensCD':     u.ravensCD = Math.min(3, u.ravensCD + 1); break
      case 'ravensPower':  u.ravensPower = Math.min(3, u.ravensPower + 1); break
      case 'ravensCount':  u.ravensCount = Math.min(2, u.ravensCount + 1); break
      case 'spear':         u.spear = true; break
      case 'spearCount':    u.spearCount = Math.min(5, u.spearCount + 1); break
      case 'spearInterval': u.spearInterval = Math.min(3, u.spearInterval + 1); break
      case 'spearPierce':   u.spearPierce = Math.min(2, u.spearPierce + 1); break
      case 'spearSpeed':    u.spearSpeed = Math.min(5, u.spearSpeed + 1); break
      case 'spearStorm':    u.spearStorm = true; break
      case 'xpGain':        u.xpGain = Math.min(5, u.xpGain + 1); break
      case 'magnetRange':   u.magnetRange = Math.min(3, u.magnetRange + 1); break
      case 'dashCooldown':  u.dashCooldownPicks = Math.min(4, u.dashCooldownPicks + 1); break
      case 'dashDistance':  u.dashDistancePicks = Math.min(3, u.dashDistancePicks + 1); break
      case 'meleeRange':    u.meleeRange = Math.min(4, u.meleeRange + 1); break
      case 'meleeSpeed':    u.meleeSpeed = Math.min(4, u.meleeSpeed + 1); break
      case 'meleeDamage':   u.meleeDamage = Math.min(4, u.meleeDamage + 1); break
      case 'meleeArcWidth': u.meleeArcWidth = Math.min(3, u.meleeArcWidth + 1); break

    }

    obs('UPGRADE', `Lv${p.level} picked ${upgradeId} | queuedXP=${queuedXP}`)

    // Apply XP that arrived while the upgrade screen was open, and re-check for overflow
    if (queuedXP > 0 || p.xp >= xpNeeded(p.level)) {
      this.grantXPToPlayer(p, queuedXP)
    }
  }

  handleRerollUpgrade(playerId: string) {
    const p = this.players.find(p => p.id === playerId)
    if (!p || p.dead || !p.pendingChoices || p.rerollsLeft <= 0) return
    p.rerollsLeft--
    const choices = pickUpgradeChoices(p.upgrades, p.characterType === 'ares', p.unlockedWeapons)
    if (choices.length > 0) p.pendingChoices = choices
    this.send(p.ws, { type: 'rerollChoices', choices: p.pendingChoices ?? [] })
  }

  handleHitBrazier(playerId: string, brazierId: number, damage: number) {
    if (!this.started || this.finished) return
    if (!Number.isInteger(brazierId) || brazierId < 0 || !isFinite(damage) || damage <= 0) return
    const player = this.players.find(p => p.id === playerId)
    if (!player || player.dead) return
    const brazier = this.braziers.get(brazierId)
    if (!brazier) return

    const safeDamage = Math.min(Math.floor(damage), 100)
    brazier.hp -= safeDamage

    if (brazier.hp <= 0) {
      this.braziers.delete(brazierId)
      const drop = rollBrazierDrop()

      if (drop === 'coin') {
        player.coins += 1
      } else if (drop === 'coinBag') {
        player.coins += 3
      } else if (drop === 'freeze') {
        this.spawner.freeze(10_000)
      } else if (drop === 'rerollDie') {
        player.rerollsLeft++
      } else if (drop === 'divineWrath') {
        const killed = this.spawner.killAllNonBoss()
        for (const d of killed) {
          this.broadcast({ type: 'enemyDied', enemyId: d.id, x: d.x, y: d.y, xpValue: 0 })
        }
      }

      this.broadcast({ type: 'brazierDestroy', id: brazierId, x: brazier.x, y: brazier.y, drop })
    } else {
      this.broadcast({ type: 'brazierHit', id: brazierId, hp: brazier.hp })
    }
  }

  private tickBraziers(delta: number) {
    if (this.finished) return
    const players = this.players.filter(p => !p.dead)
    if (players.length === 0) return

    this.brazierSpawnTimer += delta
    if (this.brazierSpawnTimer < BRAZIER_SPAWN_MS) return
    this.brazierSpawnTimer -= BRAZIER_SPAWN_MS

    if (Math.random() >= BRAZIER_SPAWN_CHANCE) return

    // If at cap, despawn the oldest (closest to player gets priority — VS style)
    if (this.braziers.size >= BRAZIER_CAP) {
      let oldest: ServerBrazier | null = null
      for (const b of this.braziers.values()) {
        if (!oldest || b.spawnedAt < oldest.spawnedAt) oldest = b
      }
      if (oldest) {
        this.broadcast({ type: 'brazierDestroy', id: oldest.id, x: oldest.x, y: oldest.y, drop: null })
        this.braziers.delete(oldest.id)
      }
    }

    const p = players[Math.floor(Math.random() * players.length)]
    const zoom = p.viewW <= 768 ? 0.7 : 1.2
    const halfW = (p.viewW / 2) / zoom + 80
    const halfH = (p.viewH / 2) / zoom + 80
    const edge = Math.floor(Math.random() * 4)
    let bx: number, by: number
    switch (edge) {
      case 0: bx = p.x + (Math.random() * 2 - 1) * halfW; by = p.y - halfH; break
      case 1: bx = p.x + (Math.random() * 2 - 1) * halfW; by = p.y + halfH; break
      case 2: bx = p.x - halfW; by = p.y + (Math.random() * 2 - 1) * halfH; break
      default: bx = p.x + halfW; by = p.y + (Math.random() * 2 - 1) * halfH; break
    }

    const id = ++this.brazierIdCtr
    this.braziers.set(id, { id, x: bx, y: by, hp: BRAZIER_HP, spawnedAt: this.spawner.runElapsed })
    this.broadcast({ type: 'brazierSpawn', id, x: bx, y: by, hp: BRAZIER_HP })
  }

  handleCollectXP(playerId: string, amount: number) {
    if (!this.started || this.finished || amount <= 0) return
    const player = this.players.find(p => p.id === playerId)
    if (!player || player.dead) return
    const safeAmount = Math.min(Math.floor(amount), 50_000)
    if (player.pendingChoices !== null) {
      player.pendingRawXP += safeAmount
      return
    }
    this.grantXPToPlayer(player, safeAmount)
  }

  private grantXPToPlayer(p: Player, rawAmount: number) {
    const RUN_DURATION = 30 * 60 * 1000
    const xpScale = 1 + Math.min(this.spawner.runElapsed / RUN_DURATION, 1)
    const gained = Math.round(rawAmount * xpScale * (1 + p.upgrades.xpGain * 0.08))
    p.xp += gained
    const needed = xpNeeded(p.level)
    if (p.xp >= needed) {
      p.xp -= needed
      p.level++
      const choices = pickUpgradeChoices(p.upgrades, p.characterType === 'ares', p.unlockedWeapons)
      // If no upgrades are eligible (all maxed), level up silently — don't block XP with pendingChoices
      p.pendingChoices = choices.length > 0 ? choices : null
      obs('LEVEL', `→ Lv${p.level} | gained=${gained} needed=${needed} overflow=${p.xp} nextNeed=${xpNeeded(p.level)} | scale=${xpScale.toFixed(2)} xpGain=${p.upgrades.xpGain}`)
      this.send(p.ws, {
        type: 'levelUp',
        level: p.level,
        xp: p.xp,
        xpToNext: xpNeeded(p.level),
        choices,
      })
    } else {
      obs('XP', `+${gained} (raw=${rawAmount}) → ${p.xp}/${needed} | Lv${p.level} | scale=${xpScale.toFixed(2)} xpGain=${p.upgrades.xpGain}`)
      this.send(p.ws, { type: 'xpGrant', xp: p.xp, xpToNext: needed })
    }
  }

  private grantXP(xpValue: number) {
    for (const p of this.players) {
      if (p.dead || p.pendingChoices !== null) continue
      this.grantXPToPlayer(p, xpValue)
    }
  }

  adminSpawn(entity: string, requesterId: string) {
    if (!this.started || this.finished) return
    const requester = this.players.find(p => p.id === requesterId)
    if (!requester) return
    const positions = this.players.map(p => ({ x: p.x, y: p.y, viewW: p.viewW, viewH: p.viewH, aura: p.aura, auraRange: p.upgrades.auraRange, level: p.level }))
    const ITEM_DIST = 220 + Math.random() * 80
    const angle = Math.random() * Math.PI * 2
    const ix = requester.x + Math.cos(angle) * ITEM_DIST
    const iy = requester.y + Math.sin(angle) * ITEM_DIST

    if (entity === 'potion' || entity === 'xporb' || entity === 'coin') {
      this.send(requester.ws, { type: 'adminSpawnItem', entity, x: ix, y: iy })
    } else if (entity.startsWith('weapon:')) {
      const upgradeId = entity.slice(7)
      const u = requester.upgrades
      switch (upgradeId) {
        case 'wand':        u.wand = true; break
        case 'boomerang':   u.boomerang = true; break
        case 'flameTrail':  u.flameTrail = true; break
        case 'bloodNova':   u.bloodNova = true; break
        case 'lightning':   u.lightning = true; break
        case 'axe':         u.axe = true; break
        case 'aura':        u.aura = true; requester.aura = 1; break
        case 'orbital':     u.orbital = Math.min(5, u.orbital + 1); requester.orbital = u.orbital; break
        case 'equinox':     u.equinox = true; break
        case 'solstice':    u.solstice = true; break
        case 'ravens':      u.ravens = true; break
        case 'spear':       u.spear = true; break
        case 'melee':       u.isMeleeChar = true; break
      }
      this.send(requester.ws, { type: 'adminGrantUpgrade', upgradeId })
    } else {
      const spawned = this.spawner.adminSpawnEnemy(entity, positions)
      if (spawned && spawned.isBoss) {
        this.bosses.set(spawned.id, spawned.maxHp)
        this.broadcast({ type: 'bossSpawn', bossId: spawned.id, maxHp: spawned.maxHp, final: spawned.kind === 'finalBoss', kind: spawned.kind })
      }
    }
  }

  adminGiveUpgrade(requesterId: string, upgradeId: string, targetLevel: number) {
    if (!this.started || this.finished) return
    if (!VALID_UPGRADE_SET.has(upgradeId)) return
    const requester = this.players.find(p => p.id === requesterId)
    if (!requester) return

    const level = Math.max(0, Math.floor(targetLevel))
    const u = requester.upgrades

    switch (upgradeId as UpgradeId | 'dashCooldown' | 'dashDistance') {
      case 'wand':               u.wand = level >= 1; break
      case 'piercing':           u.piercing = level >= 1; break
      case 'multiShot':          u.multiShot = Math.min(4, level); break
      case 'orbital':            u.orbital = Math.min(5, level); requester.orbital = u.orbital; break
      case 'orbSpeed':           u.orbSpeed = Math.min(3, level); break
      case 'orbPower':           u.orbPower = Math.min(3, level); break
      case 'orbRange':           u.orbRange = Math.min(2, level); break
      case 'boomerang':          u.boomerang = level >= 1; break
      case 'flameTrail':         u.flameTrail = level >= 1; break
      case 'bloodNova':          u.bloodNova = level >= 1; break
      case 'bloodNovaCD':        u.bloodNovaCD = Math.min(4, level); break
      case 'vampiric':           u.vampiric = level >= 1; break
      case 'lightning':          u.lightning = level >= 1; break
      case 'lightningTargets':   u.lightningTargets = Math.min(2, level); break
      case 'lightningCooldown':  u.lightningCooldown = Math.min(2, level); break
      case 'might':              u.mightPicks = Math.min(5, level); break
      case 'axe':                u.axe = level >= 1; break
      case 'axeAmount':          u.axeAmount = Math.min(2, level); break
      case 'axeDamage':          u.axeDamage = Math.min(1, level); break
      case 'axePierce':          u.axePierce = Math.min(1, level); break
      case 'axeEvolution':       u.axeEvolution = level >= 1; break
      case 'aura':               u.aura = level >= 1; requester.aura = u.aura ? 1 : 0; break
      case 'auraTick':           u.auraTick = Math.min(3, level); break
      case 'auraRange':          u.auraRange = Math.min(3, level); break
      case 'divineShield':       u.divineShield = level >= 1; break
      case 'xpGain':             u.xpGain = Math.min(5, level); break
      case 'magnetRange':        u.magnetRange = Math.min(3, level); break
      case 'dashCooldown':       u.dashCooldownPicks = Math.min(4, level); break
      case 'dashDistance':       u.dashDistancePicks = Math.min(3, level); break
      case 'equinox':            u.equinox = level >= 1; break
      case 'solstice':           u.solstice = level >= 1; break
      case 'dualGunDamage':      u.dualGunDamage = Math.min(3, level); break
      case 'dualGunSpeed':       u.dualGunSpeed = Math.min(2, level); break
      case 'dualGunExtra':       u.dualGunExtra = Math.min(2, level); break
      case 'echo':               u.echo = Math.min(2, level); break
      case 'ravens':             u.ravens = level >= 1; break
      case 'ravensCD':           u.ravensCD = Math.min(3, level); break
      case 'ravensPower':        u.ravensPower = Math.min(3, level); break
      case 'ravensCount':        u.ravensCount = Math.min(2, level); break
      case 'spear':              u.spear = level >= 1; break
      case 'spearCount':         u.spearCount = Math.min(5, level); break
      case 'spearInterval':      u.spearInterval = Math.min(3, level); break
      case 'spearPierce':        u.spearPierce = Math.min(2, level); break
      case 'spearSpeed':         u.spearSpeed = Math.min(5, level); break
      case 'spearStorm':         u.spearStorm = level >= 1; break
      case 'meleeRange':         u.meleeRange = Math.min(4, level); break
      case 'meleeSpeed':         u.meleeSpeed = Math.min(4, level); break
      case 'meleeDamage':        u.meleeDamage = Math.min(4, level); break
      case 'meleeArcWidth':      u.meleeArcWidth = Math.min(3, level); break
    }

    this.send(requester.ws, { type: 'adminSetUpgrade', upgradeId, level })
  }

  adminClearUpgrades(requesterId: string) {
    if (!this.started || this.finished) return
    const requester = this.players.find(p => p.id === requesterId)
    if (!requester) return
    requester.upgrades = { ...emptyUpgrades(), ...startingUpgrades(requester.characterType) }
    requester.aura = 0
    requester.orbital = 0
    this.send(requester.ws, { type: 'adminClearUpgrades' })
  }

  removePlayer(id: string): boolean {
    const leaving = this.players.find(p => p.id === id)
    if (leaving && !leaving.dead) {
      this.broadcast({ type: 'playerLeft' })
      // finishGame reads this.players to build results — call it BEFORE filtering
      // so the quitting player's coins/kills are included in the DB save.
      if (this.isSolo && this.started) this.finishGame(false)
    }
    this.players = this.players.filter(p => p.id !== id)
    if (this.players.length === 0) {
      this.stop()
      return true  // room is empty, discard it
    }
    return false
  }

  get isFull(): boolean { return this.players.length >= MAX_PLAYERS }
  get isEmpty(): boolean { return this.players.length === 0 }
  get isStarted(): boolean { return this.started }
  get waitingUsernames(): string[] { return this.players.map(p => p.username) }

  sendRunSaved(userId: number, msg: { kills: number; timeSurvived: number; coins: number; won: boolean; newAchievements: string[]; newWeaponUnlocks: string[] }) {
    const p = this.players.find(p => p.userId === userId)
    if (p) this.send(p.ws, { type: 'runSaved', ...msg })
  }

  private startLoop() {
    this.started = true
    this.startMs = Date.now()
    this.spawner.onBossWarning = (final) => {
      this.broadcast({ type: 'bossWarning', final }, true)
    }
    this.spawner.onBossSpawn = (e) => {
      this.bosses.set(e.id, e.maxHp)
      this.broadcast({ type: 'bossSpawn', bossId: e.id, maxHp: e.maxHp, final: e.kind === 'finalBoss', kind: e.kind }, true)
    }
    this.spawner.onSurge = (enemyType) => {
      this.broadcast({ type: 'surge', enemyType }, true)
    }
    this.spawner.onExploderExplode = (x, y) => {
      this.broadcast({ type: 'exploderExplode', x, y }, true)
    }
    this.spawner.onBossInvuln = (bossId, invulnerable) => {
      this.broadcast({ type: 'bossInvuln', bossId, invulnerable }, true)
    }
    this.spawner.onFinalBossDefeated = () => {
      this.broadcast({ type: 'gameOver', won: true })
      this.finishGame(true)
    }

    this.interval = setInterval(() => this.tick(), TICK_MS)
  }

  private finishGame(won: boolean) {
    if (this.finished) return
    this.finished = true
    this.stop()
    if (!this.onGameEnd) return
    // spawner.runElapsed is total game time including any pre-refresh portion (resumed runs)
    const timeSurvived = this.spawner.runElapsed
    const results: PlayerRunData[] = this.players.map(p => {
      const u = p.upgrades
      const weaponCount = 1  // base attack
        + (u.wand ? 1 : 0)
        + (u.aura ? 1 : 0)
        + (u.orbital > 0 ? 1 : 0)
        + (u.boomerang ? 1 : 0)
        + (u.flameTrail ? 1 : 0)
        + (u.bloodNova ? 1 : 0)
        + (u.lightning ? 1 : 0)
        + (u.axe ? 1 : 0)
        + (u.equinox ? 1 : 0)
        + (u.solstice ? 1 : 0)
        + (u.ravens ? 1 : 0)
        + (u.spear ? 1 : 0)
      return {
        userId: p.userId,
        username: p.username,
        kills: p.kills,
        coins: p.coins,
        timeSurvived,
        won,
        bossKills: p.bossKills,
        level: p.level,
        weaponCount,
        multiplayer: !this.isSolo,
        damageDealt: p.damageDealt,
        stage: this.spawner.stage2Mode ? 2 : 1,
        characterType: p.characterType,
        spearEvolutionReady: u.spear && u.spearCount >= 5 && u.spearSpeed >= 3,
        axeEvolutionReady:   u.axe   && u.axeAmount  >= 1 && u.axeDamage >= 1 && u.axePierce >= 1,
      }
    })
    for (const p of this.players) {
      const u = p.upgrades
      const mins = Math.floor(timeSurvived / 60000)
      const secs = Math.floor((timeSurvived % 60000) / 1000)
      const upgList = [
        u.wand&&'wand', u.piercing&&'piercing', u.multiShot>0&&`multiShot${u.multiShot}`,
        u.orbital>0&&`orbital${u.orbital}`, u.orbSpeed>0&&`orbSpd${u.orbSpeed}`, u.orbPower>0&&`orbPow${u.orbPower}`, u.orbRange>0&&`orbRng${u.orbRange}`,
        u.boomerang&&'boomerang', u.flameTrail&&'flame', u.bloodNova&&'bloodNova', u.bloodNovaCD>0&&`novaCD${u.bloodNovaCD}`,
        u.vampiric&&'vampiric', u.lightning&&'lightning', u.lightningTargets>0&&`ltTgt${u.lightningTargets}`, u.lightningCooldown>0&&`ltCD${u.lightningCooldown}`,
        u.mightPicks>0&&`might${u.mightPicks}`, u.axe&&'axe', u.aura&&'aura', u.auraTick>0&&`auraTick${u.auraTick}`, u.auraRange>0&&`auraRng${u.auraRange}`,
        u.divineShield&&'shield', u.xpGain>0&&`xpGain${u.xpGain}`, u.magnetRange>0&&`magnet${u.magnetRange}`,
        u.equinox&&'equinox', u.solstice&&'solstice',
        u.dualGunDamage>0&&`dualDmg${u.dualGunDamage}`, u.dualGunSpeed>0&&`dualSpd${u.dualGunSpeed}`, u.dualGunExtra>0&&`dualX${u.dualGunExtra}`,
        u.echo>0&&`echo${u.echo}`, u.ravens&&'ravens', u.ravensCD>0&&`ravenCD${u.ravensCD}`, u.ravensPower>0&&`ravenPow${u.ravensPower}`, u.ravensCount>0&&`ravenCnt${u.ravensCount}`,
        u.spear&&'spear',
        u.dashCooldownPicks>0&&`dashCD${u.dashCooldownPicks}`, u.dashDistancePicks>0&&`dashDist${u.dashDistancePicks}`,
      ].filter(Boolean).join(' ')
      obs('END', `${won?'WON':'DIED'} | ${p.username} Lv${p.level} ${p.xp}xp | kills=${p.kills} bossKills=${p.bossKills} dmg=${p.damageDealt} | time=${mins}m${secs}s`)
      obs('END', `upgrades: ${upgList || 'none'}`)
    }
    this.onGameEnd(results)
  }

  private tick() {
    try {
      const alivePlayers = this.players.filter(p => !p.dead)
      const src = alivePlayers.length > 0 ? alivePlayers : this.players
      const positions = src.map(p => ({ x: p.x, y: p.y, viewW: p.viewW, viewH: p.viewH, aura: p.aura, auraRange: p.upgrades.auraRange, level: p.level }))
      this.spawner.update(positions, TICK_MS)
      this.tickBraziers(TICK_MS)

      // Stage 2: survive-to-end win condition (no final boss in this stage)
      if (this.spawner.stage2Mode && this.spawner.isFinished && !this.finished) {
        this.broadcast({ type: 'gameOver', won: true })
        this.finishGame(true)
        return
      }

      for (const e of this.spawner.all) {
        if (e.pendingProjectiles.length > 0) {
          for (const proj of e.pendingProjectiles) {
            this.broadcast({ type: 'bossProjectile', enemyId: e.id, x: proj.x, y: proj.y, vx: proj.vx, vy: proj.vy })
          }
          e.pendingProjectiles = []
        }
      }

      this.broadcast({
        type: 'tick',
        enemies: this.spawner.all.map(e => e.snapshot()),
        players: this.playerSnapshots(),
        elapsed: this.spawner.runElapsed,
      })
    } catch (err) {
      console.error('Tick error:', err)
    }
  }

  private stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null }
  }

  private playerSnapshots(): PlayerSnapshot[] {
    return this.players
      .filter(p => !p.dead)
      .map(p => ({ id: p.id, x: p.x, y: p.y, characterType: p.characterType, username: p.username, aura: p.aura, orbital: p.orbital, ravens: p.upgrades.ravens ? 1 : 0 }))
  }

  private broadcast(msg: S2CMessage, skipPaused = false) {
    const data = JSON.stringify(msg)
    for (const p of this.players) {
      if (skipPaused && p.paused) continue
      if (p.ws.readyState === 1) p.ws.send(data)
    }
  }

  private send(ws: WebSocket, msg: S2CMessage) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg))
  }
}
