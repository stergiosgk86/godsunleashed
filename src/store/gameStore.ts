import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { useProfileStore } from './profileStore'

export const DASH_COOLDOWN_MS = 5000

export type UpgradeId = 'moveSpeed' | 'dashCooldown' | 'dashDistance' | 'wand' | 'multiShot' | 'piercing' | 'aura' | 'auraTick' | 'auraRange' | 'orbital' | 'orbSpeed' | 'orbPower' | 'orbRange' | 'boomerang' | 'flameTrail' | 'bloodNova' | 'bloodNovaCD' | 'vampiric' | 'lightning' | 'lightningTargets' | 'lightningCooldown' | 'might' | 'axe' | 'axeAmount' | 'axeDamage' | 'axePierce' | 'axeEvolution' | 'divineShield' | 'xpGain' | 'magnetRange' | 'equinox' | 'solstice' | 'dualGunDamage' | 'dualGunSpeed' | 'dualGunExtra' | 'echo' | 'ravens' | 'ravensCD' | 'ravensPower' | 'ravensCount' | 'spear' | 'spearCount' | 'spearInterval' | 'spearPierce' | 'spearSpeed' | 'spearStorm' | 'meleeRange' | 'meleeSpeed' | 'meleeDamage'

export type AdminSpawnEntity =
  | 'basic' | 'speeder' | 'tank' | 'ranged' | 'exploder' | 'ghost' | 'charger' | 'necromancer'
  | 'veteran' | 'brute' | 'revenant' | 'warlord' | 'titan'
  | 'boss' | 'summoner' | 'finalBoss'
  | 'potion' | 'xporb' | 'coin'
  | 'weapon:wand' | 'weapon:boomerang' | 'weapon:flameTrail' | 'weapon:bloodNova'
  | 'weapon:lightning' | 'weapon:axe' | 'weapon:aura' | 'weapon:orbital'
  | 'weapon:equinox' | 'weapon:solstice' | 'weapon:ravens' | 'weapon:spear'

export function weaponBaseDamage(level: number): number {
  return 8 + Math.floor(level * 0.7)
}

export interface Upgrade {
  id: UpgradeId
  label: string
  description: string
}

export const UPGRADE_POOL: Upgrade[] = [
  { id: 'dashCooldown',  label: 'Swift Dash',      description: '25% shorter dash cooldown' },
  { id: 'dashDistance',  label: 'Longer Dash',     description: '40% further dash distance' },
  { id: 'wand',          label: 'Arcane Wand',     description: 'Fires a magic bolt at the nearest enemy' },
  { id: 'multiShot',     label: 'Multi Shot',      description: 'Wand fires an extra bolt per attack (stackable, up to 4×)' },
  { id: 'piercing',      label: 'Piercing',        description: 'Wand bolts pass through enemies' },
  { id: 'aura',          label: 'Aura',            description: 'Pulses damage to all enemies in range and knocks them back' },
  { id: 'auraTick',     label: 'Aura Tempo',      description: 'Aura pulses 100ms faster (stackable, up to 3×)' },
  { id: 'auraRange',    label: 'Aura Range',      description: 'Expands the aura radius (stackable, up to 3×)' },
  { id: 'orbital',      label: 'Spirit Orb',      description: 'An orb orbits you, damaging and knocking back enemies on contact (+1 orb per pick, max 5)' },
  { id: 'orbSpeed',     label: 'Orb Velocity',    description: 'Spirit Orbs rotate 25% faster (stackable, up to 3×)' },
  { id: 'orbPower',     label: 'Orb Power',       description: 'Spirit Orbs deal 20% more damage (stackable, up to 3×)' },
  { id: 'orbRange',     label: 'Orb Reach',       description: 'Spirit Orbs orbit at a wider radius, covering more ground (stackable, up to 2×)' },
  { id: 'boomerang',   label: 'Boomerang',        description: 'Throws a disc that flies out then returns, hitting enemies twice' },
  { id: 'flameTrail',  label: 'Flame Trail',      description: 'Leaves burning patches as you move that damage nearby enemies' },
  { id: 'bloodNova',   label: 'Blood Nova',       description: 'Every 90s wipes all enemies on screen in a massive dark shockwave' },
  { id: 'bloodNovaCD', label: 'Dark Convergence', description: 'Blood Nova triggers 10s sooner (stackable, up to 4×, down to 50s)' },
  { id: 'vampiric',   label: 'Soul Drain',       description: 'Each hit restores 0.25% of damage dealt as HP (scales well with fast weapons)' },
  { id: 'lightning',        label: 'Thunder Strike',    description: 'Every 4.5s lightning bolts strike 2 random enemies for heavy damage' },
  { id: 'lightningTargets', label: 'Storm Surge',       description: 'Thunder Strike hits 1 additional enemy (stackable, up to +2)' },
  { id: 'lightningCooldown',label: 'Thunderhaste',      description: 'Thunder Strike fires 1s faster (stackable, up to 2×)' },
  { id: 'might',     label: 'Power',            description: '+10% weapon damage (stackable)' },
  { id: 'axe',         label: 'Mjölnir',      description: 'Hurls the legendary Mjölnir in an arc — strikes enemies on the way up and again on the return' },
  { id: 'axeAmount',   label: 'Double Throw',      description: '+1 Mjölnir per throw (stackable ×2) — two hammers arc one after another through enemy formations' },
  { id: 'axeDamage',   label: 'Mjölnir Mastery',   description: '+50% Mjölnir damage — each throw strikes harder through armored foes' },
  { id: 'axePierce',   label: 'Broad Impact',      description: 'Mjölnir grows larger (+50% hit radius), cleaving through wider enemy formations' },
  { id: 'axeEvolution',label: "Berserker's Ring", description: "Evolution — transforms Mjölnir into a ring of 6 orbiting axes that shred every enemy in their path. Requires all 3 axe upgrades." },
  { id: 'divineShield', label: 'Divine Shield', description: 'Grants periodic invincibility — active for 3s, then recharges for 9s. While active, all damage is blocked.' },
  { id: 'xpGain',       label: 'Gilded Soul',   description: '+8% XP gained from all sources (stackable, up to 5×)' },
  { id: 'magnetRange',  label: 'Astral Pull',   description: 'XP orbs are attracted from 50% further away (stackable, up to 3×)' },
  { id: 'equinox',      label: 'Equinox',        description: 'Fires gold piercing sunray bolts in all 4 diagonal directions.' },
  { id: 'solstice',     label: 'Solstice',       description: 'Fires cyan piercing sunray bolts in all 4 diagonal directions. Pick both for staggered double volleys.' },
  { id: 'dualGunDamage',label: 'Solar Intensity', description: 'Sunray bolts deal 30% more damage and pierce +1 extra enemy (stackable, up to 3×)' },
  { id: 'dualGunSpeed', label: 'Solar Tempo',    description: 'Sunray guns fire 20% faster (stackable, up to 2×)' },
  { id: 'dualGunExtra', label: 'Solar Barrage',  description: 'Fires one extra staggered burst per gun per volley (stackable, up to 2×)' },
  { id: 'echo',         label: 'Echo',           description: 'Each projectile weapon fires one additional copy per attack — wand, boomerang, axe, sunrays, spear, and Thunder Strike all gain an extra strike (stackable, up to 2×)' },
  { id: 'spear',         label: 'Bifrost Spear',   description: 'Hurls a glowing lance in the direction you move, piercing up to 3 enemies per throw' },
  { id: 'spearCount',   label: 'Spear Barrage',  description: '+1 spear per burst — all fire in rapid succession (up to 6 total, stackable ×5)' },
  { id: 'spearInterval',label: 'Spear Tempo',    description: 'Throws erupt faster and burst tighter (stackable ×3)' },
  { id: 'spearPierce',  label: 'Spear Pierce',   description: '+1 enemy pierced per spear (from 3 up to 5, stackable ×2)' },
  { id: 'spearSpeed',   label: 'Bracer',          description: '+10% spear velocity (stackable ×5, required for Thousand Spears)' },
  { id: 'spearStorm',   label: 'Thousand Spears', description: 'Evolution — transforms the burst into a never-ending torrent of piercing lances. Requires max Barrage and Bracer ×3.' },
  { id: 'ravens',      label: "Odin's Ravens",  description: "A raven orbits you, bombing a rotating golden zone with dark feathers that pierce all enemies" },
  { id: 'ravensCD',    label: "Raven's Fury",   description: 'Ravens bomb 500ms faster (stackable, up to 3×, down to 2s)' },
  { id: 'ravensPower', label: "Raven's Curse",  description: 'Each feather deals 20% more damage (stackable, up to 3×)' },
  { id: 'ravensCount', label: 'Murder of Crows', description: '+2 feathers per bomb set (stackable, up to 2×)' },
  { id: 'meleeRange',  label: 'Iron Reach',     description: 'Melee arc extends 25% further (stackable, up to ×4)' },
  { id: 'meleeSpeed',  label: 'Battle Fury',    description: 'Melee strikes 15% faster (stackable, up to ×4)' },
  { id: 'meleeDamage', label: 'Blade Mastery',  description: '+20% melee arc damage (stackable, up to ×4)' },
]

// XP curve: L1=30, L2=55, L3=80 (+25/level), spikes at L20/L40
function xpNeeded(level: number): number {
  const base = 30 + (level - 1) * 25
  if (level === 20) return base + 600
  if (level === 40) return base + 2400
  return base
}

const DASH_IDS = new Set<UpgradeId>(['dashCooldown', 'dashDistance'])
const SPEAR_BURST_IDS = new Set<UpgradeId>(['spearCount', 'spearInterval', 'spearPierce'])
const AXE_UPGRADE_IDS = new Set<UpgradeId>(['axeAmount', 'axeDamage', 'axePierce', 'axeEvolution'])
const MELEE_UPGRADE_IDS = new Set<UpgradeId>(['meleeRange', 'meleeSpeed', 'meleeDamage'])

type PickState = { wand: boolean; multiShot: number; piercing: boolean; orbital: number; orbSpeed: number; orbPower: number; orbRange: number; boomerang: boolean; flameTrail: boolean; bloodNova: boolean; bloodNovaCD: number; vampiric: boolean; lightning: boolean; lightningTargets: number; lightningCooldown: number; might: number; mightPicks: number; axe: boolean; axeAmount: number; axeDamage: number; axePierce: number; axeEvolution: boolean; aura: number; auraTick: number; auraRange: number; divineShield: boolean; xpGain: number; magnetRange: number; equinox: boolean; solstice: boolean; dualGunDamage: number; dualGunSpeed: number; dualGunExtra: number; echo: number; dashCooldown: number; dashDistance: number; ravens: boolean; ravensCD: number; ravensPower: number; ravensCount: number; spear: boolean; spearCount: number; spearInterval: number; spearPierce: number; spearSpeed: number; spearStorm: boolean; meleeRange: number; meleeArc: number; meleeSpeed: number; meleeDamage: number; isMeleeChar: boolean }

function upgradeWeight(id: UpgradeId, s: PickState): number {
  if ((id === 'multiShot' || id === 'piercing') && s.wand) return 10
  if ((id === 'auraTick'  || id === 'auraRange') && s.aura > 0) return 10
  if ((id === 'lightningTargets' || id === 'lightningCooldown') && s.lightning) return 10
  if (id === 'bloodNovaCD' && s.bloodNova) return 10
  if ((id === 'dualGunDamage' || id === 'dualGunSpeed' || id === 'dualGunExtra') && (s.equinox || s.solstice)) return 10
  if (id === 'echo' && (s.wand || s.boomerang || s.axe || s.equinox || s.solstice || s.spear)) return 10
  if ((id === 'axeAmount' || id === 'axeDamage' || id === 'axePierce' || id === 'axeEvolution') && s.axe) return 10
  if ((id === 'ravensCD' || id === 'ravensPower' || id === 'ravensCount') && s.ravens) return 10
  if ((id === 'spearCount' || id === 'spearInterval' || id === 'spearPierce' || id === 'spearSpeed' || id === 'spearStorm') && s.spear) return 10
  if ((id === 'meleeRange' || id === 'meleeSpeed' || id === 'meleeDamage') && s.isMeleeChar) return 10
  if (id === 'orbital' && s.orbital > 0) return 8
  if ((id === 'orbSpeed' || id === 'orbPower' || id === 'orbRange') && s.orbital > 0) return 10
  if (id === 'might' || id === 'dashCooldown' || id === 'dashDistance') return 4
  return 1
}

function weightedPickOne(pool: Array<{ u: Upgrade; weight: number }>): number {
  const total = pool.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i].weight
    if (r <= 0) return i
  }
  return pool.length - 1
}

const UPGRADE_TO_WEAPON_GROUP: Partial<Record<UpgradeId, string>> = {
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

function playerOwnsGroup(group: string, s: PickState): boolean {
  switch (group) {
    case 'orbital':      return s.orbital > 0
    case 'boomerang':    return s.boomerang
    case 'flameTrail':   return s.flameTrail
    case 'bloodNova':    return s.bloodNova
    case 'lightning':    return s.lightning
    case 'axe':          return s.axe
    case 'aura':         return s.aura > 0
    case 'equinox':      return s.equinox || s.solstice
    case 'ravens':       return s.ravens
    case 'spear':        return s.spear
    case 'vampiric':     return s.vampiric
    case 'divineShield': return s.divineShield
    case 'echo':         return s.echo > 0
    default:             return true
  }
}

function pickChoices(state: PickState, unlockedWeapons: Set<string>): Upgrade[] {
  const eligible = UPGRADE_POOL.filter(u => {
    // Weapon unlock gate: only offer weapons the player has unlocked
    // (unless they already own it via starting equipment)
    const group = UPGRADE_TO_WEAPON_GROUP[u.id]
    if (group && !playerOwnsGroup(group, state) && !unlockedWeapons.has(group)) return false

    if (u.id === 'wand'       && state.wand)            return false
    if (u.id === 'multiShot'  && !state.wand)           return false
    if (u.id === 'multiShot'  && state.multiShot >= 4)  return false
    if (u.id === 'dashCooldown' && state.dashCooldown <= Math.max(400, Math.floor(DASH_COOLDOWN_MS * Math.pow(0.75, 4)))) return false
    if (u.id === 'dashDistance' && state.dashDistance >= 1 + 3 * 0.4 - 0.001) return false
    if (u.id === 'piercing'   && !state.wand)           return false
    if (u.id === 'piercing'   && state.piercing)        return false
    if (u.id === 'orbital'    && state.orbital >= 5)    return false
    if (u.id === 'orbSpeed'   && state.orbital === 0)   return false
    if (u.id === 'orbSpeed'   && state.orbSpeed >= 3)   return false
    if (u.id === 'orbPower'   && state.orbital === 0)   return false
    if (u.id === 'orbPower'   && state.orbPower >= 3)   return false
    if (u.id === 'orbRange'   && state.orbital === 0)   return false
    if (u.id === 'orbRange'   && state.orbRange >= 2)   return false
    if (u.id === 'boomerang'  && state.boomerang)       return false
    if (u.id === 'flameTrail' && state.flameTrail)      return false
    if (u.id === 'bloodNova'    && state.bloodNova)           return false
    if (u.id === 'bloodNovaCD'  && !state.bloodNova)          return false
    if (u.id === 'bloodNovaCD'  && state.bloodNovaCD >= 4)    return false
    if (u.id === 'vampiric'   && state.vampiric)        return false
    if (u.id === 'lightning'         && state.lightning)                   return false
    if (u.id === 'lightningTargets'  && !state.lightning)                  return false
    if (u.id === 'lightningTargets'  && state.lightningTargets >= 2)       return false
    if (u.id === 'lightningCooldown' && !state.lightning)                  return false
    if (u.id === 'lightningCooldown' && state.lightningCooldown >= 2)      return false
    if (u.id === 'might'      && state.mightPicks >= 5)  return false
    if (u.id === 'axe'          && state.axe)                          return false
    if (u.id === 'axeAmount'    && !state.axe)                         return false
    if (u.id === 'axeAmount'    && state.axeAmount >= 2)               return false
    if (u.id === 'axeDamage'    && !state.axe)                         return false
    if (u.id === 'axeDamage'    && state.axeDamage >= 1)               return false
    if (u.id === 'axePierce'    && !state.axe)                         return false
    if (u.id === 'axePierce'    && state.axePierce >= 1)               return false
    if (u.id === 'axeEvolution' && !state.axe)                         return false
    if (u.id === 'axeEvolution' && state.axeAmount < 1)                return false
    if (u.id === 'axeEvolution' && state.axeDamage < 1)                return false
    if (u.id === 'axeEvolution' && state.axePierce < 1)                return false
    if (u.id === 'axeEvolution' && state.axeEvolution)                 return false
    if (u.id === 'divineShield' && state.divineShield)  return false
    if (u.id === 'xpGain'     && state.xpGain >= 5)        return false
    if (u.id === 'magnetRange' && state.magnetRange >= 3)  return false
    if (u.id === 'aura'       && state.aura >= 1)       return false
    if (u.id === 'auraTick'   && state.aura === 0)      return false
    if (u.id === 'auraTick'   && state.auraTick >= 3)   return false
    if (u.id === 'auraRange'  && state.aura === 0)      return false
    if (u.id === 'auraRange'  && state.auraRange >= 3)  return false
    if (u.id === 'equinox'       && state.equinox)                           return false
    if (u.id === 'solstice'      && state.solstice)                          return false
    if (u.id === 'dualGunDamage' && !state.equinox && !state.solstice)      return false
    if (u.id === 'dualGunDamage' && state.dualGunDamage >= 3)               return false
    if (u.id === 'dualGunSpeed'  && !state.equinox && !state.solstice)      return false
    if (u.id === 'dualGunSpeed'  && state.dualGunSpeed >= 2)                return false
    if (u.id === 'dualGunExtra'  && !state.equinox && !state.solstice)      return false
    if (u.id === 'dualGunExtra'  && state.dualGunExtra >= 2)                return false
    if (u.id === 'echo' && state.echo >= 2)                                 return false
    if (u.id === 'ravens'      && state.ravens)             return false
    if (u.id === 'ravensCD'    && !state.ravens)            return false
    if (u.id === 'ravensCD'    && state.ravensCD >= 3)      return false
    if (u.id === 'ravensPower' && !state.ravens)            return false
    if (u.id === 'ravensPower' && state.ravensPower >= 3)   return false
    if (u.id === 'ravensCount' && !state.ravens)            return false
    if (u.id === 'ravensCount' && state.ravensCount >= 2)   return false
    if (u.id === 'spear'          && state.spear)                       return false
    if (u.id === 'spearCount'     && !state.spear)                      return false
    if (u.id === 'spearCount'     && state.spearCount >= 5)             return false
    if (u.id === 'spearInterval'  && !state.spear)                      return false
    if (u.id === 'spearInterval'  && state.spearInterval >= 3)          return false
    if (u.id === 'spearPierce'    && !state.spear)                      return false
    if (u.id === 'spearPierce'    && state.spearPierce >= 2)            return false
    if (u.id === 'spearSpeed'     && !state.spear)                      return false
    if (u.id === 'spearSpeed'     && state.spearSpeed >= 5)             return false
    if (u.id === 'spearStorm'     && !state.spear)                      return false
    if (u.id === 'spearStorm'     && state.spearCount < 5)              return false
    if (u.id === 'spearStorm'     && state.spearSpeed < 3)              return false
    if (u.id === 'spearStorm'     && state.spearStorm)                  return false
    if ((u.id === 'meleeRange' || u.id === 'meleeSpeed' || u.id === 'meleeDamage') && !state.isMeleeChar) return false
    if (u.id === 'meleeRange'     && state.meleeRange >= 4)             return false
    if (u.id === 'meleeSpeed'     && state.meleeSpeed >= 4)             return false
    if (u.id === 'meleeDamage'    && state.meleeDamage >= 4)            return false
    return true
  })

  // Weighted draw without replacement
  const remaining = eligible.map(u => ({ u, weight: upgradeWeight(u.id, state) }))
  const choices: Upgrade[] = []
  for (let pick = 0; pick < 3 && remaining.length > 0; pick++) {
    const idx = weightedPickOne(remaining)
    choices.push(remaining[idx].u)
    remaining.splice(idx, 1)
  }

  // At most one dash upgrade per offer
  const dashCount = choices.filter(u => DASH_IDS.has(u.id)).length
  if (dashCount > 1) {
    const dupIdx = choices.findLastIndex(u => DASH_IDS.has(u.id))
    const nonDash = remaining.filter(x => !DASH_IDS.has(x.u.id))
    if (dupIdx >= 0 && nonDash.length > 0) {
      choices[dupIdx] = nonDash[weightedPickOne(nonDash)].u
    }
  }
  // At most one spear burst upgrade per offer
  const spearBurstCount = choices.filter(u => SPEAR_BURST_IDS.has(u.id)).length
  if (spearBurstCount > 1) {
    const dupIdx = choices.findLastIndex(u => SPEAR_BURST_IDS.has(u.id))
    const nonSpear = remaining.filter(x => !SPEAR_BURST_IDS.has(x.u.id))
    if (dupIdx >= 0 && nonSpear.length > 0) {
      choices[dupIdx] = nonSpear[weightedPickOne(nonSpear)].u
    }
  }
  // At most one axe upgrade per offer
  const axeUpgradeCount = choices.filter(u => AXE_UPGRADE_IDS.has(u.id)).length
  if (axeUpgradeCount > 1) {
    const dupIdx = choices.findLastIndex(u => AXE_UPGRADE_IDS.has(u.id))
    const nonAxe = remaining.filter(x => !AXE_UPGRADE_IDS.has(x.u.id))
    if (dupIdx >= 0 && nonAxe.length > 0) {
      choices[dupIdx] = nonAxe[weightedPickOne(nonAxe)].u
    }
  }
  // At most one melee upgrade per offer
  const meleeCount = choices.filter(u => MELEE_UPGRADE_IDS.has(u.id)).length
  if (meleeCount > 1) {
    const dupIdx = choices.findLastIndex(u => MELEE_UPGRADE_IDS.has(u.id))
    const nonMelee = remaining.filter(x => !MELEE_UPGRADE_IDS.has(x.u.id))
    if (dupIdx >= 0 && nonMelee.length > 0) {
      choices[dupIdx] = nonMelee[weightedPickOne(nonMelee)].u
    }
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
  mightPicks: number
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
  orbSpeed: number
  orbPower: number
  orbRange: number
  wandAttackInterval: number
  wand: boolean
  boomerang: boolean
  equinox: boolean
  solstice: boolean
  dualGunDamage: number
  dualGunSpeed: number
  dualGunExtra: number
  dualGunAttackInterval: number
  echo: number
  ravens: boolean
  ravensCD: number
  ravensPower: number
  ravensCount: number
  spear: boolean
  spearCount: number
  spearInterval: number
  spearPierce: number
  spearSpeed: number
  spearStorm: boolean
  flameTrail: boolean
  bloodNova: boolean
  bloodNovaCD: number
  vampiric: boolean
  lightning: boolean
  lightningTargets: number
  lightningCooldown: number
  axe: boolean
  axeAmount: number
  axeDamage: number
  axePierce: number
  axeEvolution: boolean
  meleeRange: number
  meleeArc: number
  meleeSpeed: number
  meleeDamage: number
  isMeleeChar: boolean
  divineShield: boolean
  divineShieldActive: boolean
  xpGain: number
  magnetRange: number
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
  timeSurvived: number
  adminInvincible: boolean
  adminSpawnRequest: AdminSpawnEntity | null
  requestAdminSpawn: (entity: AdminSpawnEntity) => void
  clearAdminSpawnRequest: () => void
  adminGiveRequest: { upgradeId: string; targetLevel: number } | null
  requestAdminGiveUpgrade: (upgradeId: string, targetLevel: number) => void
  clearAdminGiveRequest: () => void
  adminClearRequest: boolean
  requestAdminClearUpgrades: () => void
  clearAdminClearRequest: () => void
  adminSetUpgrade: (upgradeId: UpgradeId, level: number) => void
  adminResetUpgrades: () => void

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
  setTimeSurvived: (ms: number) => void
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
    mightPicks: 0,
    attackInterval: 950,
    wandAttackInterval: 1200,
    equinox: false,
    solstice: false,
    dualGunDamage: 0,
    dualGunSpeed: 0,
    dualGunExtra: 0,
    dualGunAttackInterval: 1400,
    echo: 0,
    ravens: false,
    ravensCD: 0,
    ravensPower: 0,
    ravensCount: 0,
    spear: false,
    spearCount: 0,
    spearInterval: 0,
    spearPierce: 0,
    spearSpeed: 0,
    spearStorm: false,
    moveSpeed: 160,
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
    orbSpeed: 0,
    orbPower: 0,
    orbRange: 0,
    wand: false,
    boomerang: false,
    flameTrail: false,
    bloodNova: false,
    bloodNovaCD: 0,
    vampiric: false,
    lightning: false,
    lightningTargets: 0,
    lightningCooldown: 0,
    axe: false,
    axeAmount: 0,
    axeDamage: 0,
    axePierce: 0,
    axeEvolution: false,
    meleeRange: 0,
    meleeArc: 0,
    meleeSpeed: 0,
    meleeDamage: 0,
    isMeleeChar: false,
    divineShield: false,
    divineShieldActive: false,
    xpGain: 0,
    magnetRange: 0,
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
    timeSurvived: 0,
    adminInvincible: false,
    adminSpawnRequest: null,
    requestAdminSpawn: (entity) => set({ adminSpawnRequest: entity }),
    clearAdminSpawnRequest: () => set({ adminSpawnRequest: null }),
    adminGiveRequest: null,
    requestAdminGiveUpgrade: (upgradeId, targetLevel) => set({ adminGiveRequest: { upgradeId, targetLevel } }),
    clearAdminGiveRequest: () => set({ adminGiveRequest: null }),
    adminClearRequest: false,
    requestAdminClearUpgrades: () => set({ adminClearRequest: true }),
    clearAdminClearRequest: () => set({ adminClearRequest: false }),

    adminSetUpgrade: (upgradeId, level) => {
      const s = get()
      let upgrade: Partial<GameState> = {}
      switch (upgradeId) {
        case 'wand':               upgrade = { wand: level >= 1 }; break
        case 'piercing':           upgrade = { piercing: level >= 1 }; break
        case 'multiShot':          upgrade = { multiShot: level }; break
        case 'aura':               upgrade = { aura: level >= 1 ? Math.max(1, s.aura) : 0 }; break
        case 'auraTick':           upgrade = { auraTick: level }; break
        case 'auraRange':          upgrade = { auraRange: level }; break
        case 'orbital':            upgrade = { orbital: level }; break
        case 'orbSpeed':           upgrade = { orbSpeed: level }; break
        case 'orbPower':           upgrade = { orbPower: level }; break
        case 'orbRange':           upgrade = { orbRange: level }; break
        case 'boomerang':          upgrade = { boomerang: level >= 1 }; break
        case 'flameTrail':         upgrade = { flameTrail: level >= 1 }; break
        case 'bloodNova':          upgrade = { bloodNova: level >= 1 }; break
        case 'bloodNovaCD':        upgrade = { bloodNovaCD: level }; break
        case 'vampiric':           upgrade = { vampiric: level >= 1 }; break
        case 'lightning':          upgrade = { lightning: level >= 1 }; break
        case 'lightningTargets':   upgrade = { lightningTargets: level }; break
        case 'lightningCooldown':  upgrade = { lightningCooldown: level }; break
        case 'might': {
          const safeLevel = Math.min(5, Math.max(0, level))
          const baseMight = s.might - s.mightPicks * 0.1
          upgrade = { might: baseMight + safeLevel * 0.1, mightPicks: safeLevel }; break
        }
        case 'axe':                upgrade = { axe: level >= 1 }; break
        case 'axeAmount':          upgrade = { axeAmount: Math.min(2, Math.max(0, level)) }; break
        case 'axeDamage':          upgrade = { axeDamage: Math.min(1, Math.max(0, level)) }; break
        case 'axePierce':          upgrade = { axePierce: Math.min(1, Math.max(0, level)) }; break
        case 'axeEvolution':       upgrade = { axeEvolution: level >= 1 }; break
        case 'divineShield':       upgrade = { divineShield: level >= 1 }; break
        case 'xpGain':             upgrade = { xpGain: level }; break
        case 'magnetRange':        upgrade = { magnetRange: level }; break
        case 'equinox':            upgrade = { equinox: level >= 1 }; break
        case 'solstice':           upgrade = { solstice: level >= 1 }; break
        case 'dualGunDamage':      upgrade = { dualGunDamage: level }; break
        case 'dualGunSpeed':       upgrade = { dualGunSpeed: level, dualGunAttackInterval: Math.max(500, Math.floor(1400 * Math.pow(0.8, level))) }; break
        case 'dualGunExtra':       upgrade = { dualGunExtra: level }; break
        case 'echo':               upgrade = { echo: level }; break
        case 'ravens':             upgrade = { ravens: level >= 1 }; break
        case 'ravensCD':           upgrade = { ravensCD: Math.min(3, level) }; break
        case 'ravensPower':        upgrade = { ravensPower: Math.min(3, level) }; break
        case 'ravensCount':        upgrade = { ravensCount: Math.min(2, level) }; break
        case 'spear':              upgrade = { spear: level >= 1 }; break
        case 'spearCount':         upgrade = { spearCount: Math.min(5, Math.max(0, level)) }; break
        case 'spearInterval':      upgrade = { spearInterval: Math.min(3, Math.max(0, level)) }; break
        case 'spearPierce':        upgrade = { spearPierce: Math.min(2, Math.max(0, level)) }; break
        case 'spearSpeed':         upgrade = { spearSpeed: Math.min(5, Math.max(0, level)) }; break
        case 'spearStorm':         upgrade = { spearStorm: level >= 1 }; break
        case 'dashCooldown':       upgrade = { dashCooldown: Math.max(400, Math.floor(DASH_COOLDOWN_MS * Math.pow(0.75, level))) }; break
        case 'dashDistance':       upgrade = { dashDistance: 1 + level * 0.4 }; break
        case 'meleeRange':         upgrade = { meleeRange: Math.min(4, Math.max(0, level)) }; break
        case 'meleeSpeed':         upgrade = { meleeSpeed: Math.min(4, Math.max(0, level)), attackInterval: Math.max(250, Math.floor(950 * Math.pow(0.85, level))) }; break
        case 'meleeDamage':        upgrade = { meleeDamage: Math.min(4, Math.max(0, level)) }; break
      }
      set(upgrade)
    },

    adminResetUpgrades: () => set({
      wand: false, piercing: false, multiShot: 0,
      aura: 0, auraTick: 0, auraRange: 0,
      orbital: 0, orbSpeed: 0, orbPower: 0, orbRange: 0,
      boomerang: false, flameTrail: false,
      bloodNova: false, bloodNovaCD: 0, vampiric: false,
      lightning: false, lightningTargets: 0, lightningCooldown: 0,
      might: 1.0, mightPicks: 0, axe: false, axeAmount: 0, axeDamage: 0, axePierce: 0, axeEvolution: false, divineShield: false,
      xpGain: 0, magnetRange: 0,
      equinox: false, solstice: false,
      dualGunDamage: 0, dualGunSpeed: 0, dualGunExtra: 0, dualGunAttackInterval: 1400,
      echo: 0, dashCooldown: DASH_COOLDOWN_MS, dashDistance: 1,
      ravens: false, ravensCD: 0, ravensPower: 0, ravensCount: 0,
      spear: false, spearCount: 0, spearInterval: 0, spearPierce: 0, spearSpeed: 0, spearStorm: false,
      meleeRange: 0, meleeArc: 0, meleeSpeed: 0, meleeDamage: 0, attackInterval: 950,
    }),

    setServerDrivenLeveling: (value) => set({ serverDrivenLeveling: value }),

    addXP: (amount) => {
      set(s => {
        let { xp, xpNeeded: needed, level, isLevelUpPending } = s
        xp += amount
        if (xp >= needed && !isLevelUpPending) {
          const unlockedWeapons = new Set(useProfileStore.getState().unlockedWeapons)
          return {
            xp: xp - needed,
            level: level + 1,
            xpNeeded: xpNeeded(level + 1),
            isLevelUpPending: true,
            upgradeChoices: pickChoices(s, unlockedWeapons),
          }
        }
        return { xp }
      })
    },

    setAdminInvincible: (value) => set({ adminInvincible: value }),
    setDivineShield: (active) => set({ divineShieldActive: active }),

    takeContactDamage: (amount) => {
      const { hp, isDead, adminInvincible, armor, divineShieldActive, invincibleUntil } = get()
      if (isDead || adminInvincible) return
      if (Date.now() < invincibleUntil) return
      if (divineShieldActive) return
      const now = Date.now()
      const reduced = Math.max(1, amount - armor)
      set({ hp: Math.max(0, hp - reduced), invincibleUntil: now + 240, damageFlashUntil: now + 240, tookDamageThisRun: true })
      if (get().hp <= 0) get().die()
    },

    takeDamage: (amount) => {
      const { invincibleUntil, hp, isDead, adminInvincible, armor, divineShieldActive } = get()
      if (isDead || adminInvincible) return
      if (divineShieldActive) return
      if (Date.now() < invincibleUntil) return
      const now = Date.now()
      const reduced = Math.max(1, amount - armor)
      set({ hp: Math.max(0, hp - reduced), invincibleUntil: now + 240, damageFlashUntil: now + 240, tookDamageThisRun: true })
      if (get().hp <= 0) get().die()
    },

    die: () => set({ isDead: true, isPaused: true }),
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

    healPlayer: (amount) => set(s => s.isDead ? {} : { hp: Math.min(s.maxHp, s.hp + amount) }),
    addSessionCoins: (amount) => set(s => ({ sessionCoins: s.sessionCoins + amount })),
    addKill: () => set(s => ({ kills: s.kills + 1 })),
    addDamage: (amount) => set(s => ({ damageDealt: s.damageDealt + amount })),
    addBossKill: () => set(s => ({ bossKills: s.bossKills + 1 })),
    setTimeSurvived: (ms) => set({ timeSurvived: ms }),
    clearRecentAchievement: () => set({ recentAchievement: null }),

    resetRun: () => set({
      chosenUpgrade: null,
      xp: 0, xpNeeded: xpNeeded(1), level: 1,
      hp: 100, maxHp: 100,
      might: 1.0, mightPicks: 0, attackInterval: 950, wandAttackInterval: 1200, moveSpeed: 160,
      isLevelUpPending: false, upgradeChoices: [],
      invincibleUntil: 0, damageFlashUntil: 0, bossHp: null, bossMaxHp: 300, bossInvulnerable: false,
      isPaused: false, dashCooldown: DASH_COOLDOWN_MS, dashCooldownUntil: 0,
      dashDistance: 1, multiShot: 0, piercing: false, aura: 0, auraTick: 0, auraRange: 0, orbital: 0, orbSpeed: 0, orbPower: 0, orbRange: 0,
      wand: false, boomerang: false, flameTrail: false, bloodNova: false, bloodNovaCD: 0, vampiric: false, lightning: false, lightningTargets: 0, lightningCooldown: 0, axe: false, axeAmount: 0, axeDamage: 0, axePierce: 0, axeEvolution: false, divineShield: false, divineShieldActive: false, xpGain: 0, magnetRange: 0, armor: 0,
      equinox: false, solstice: false, dualGunDamage: 0, dualGunSpeed: 0, dualGunExtra: 0, dualGunAttackInterval: 1400, echo: 0,
      ravens: false, ravensCD: 0, ravensPower: 0, ravensCount: 0,
      spear: false, spearCount: 0, spearInterval: 0, spearPierce: 0, spearSpeed: 0, spearStorm: false,
      meleeRange: 0, meleeArc: 0, meleeSpeed: 0, meleeDamage: 0,
      sessionCoins: 0, isDead: false, isWon: false, hpRegen: 0, lifeDrain: 0,
      kills: 0, damageDealt: 0, bossKills: 0, tookDamageThisRun: false, recentAchievement: null, timeSurvived: 0,
    }),

    chooseUpgrade: (id) => {
      set(s => {
        let upgrade: Partial<GameState>
        switch (id) {
          case 'moveSpeed':    upgrade = { moveSpeed: Math.min(240, Math.floor(s.moveSpeed * 1.15)) }; break
          case 'dashCooldown': upgrade = { dashCooldown: Math.max(400, Math.floor(s.dashCooldown * 0.75)) }; break
          case 'dashDistance': upgrade = { dashDistance: s.dashDistance + 0.4 }; break
          case 'multiShot':    upgrade = { multiShot: s.multiShot + 1 }; break
          case 'piercing':     upgrade = { piercing: true }; break
          case 'aura':         upgrade = { aura: s.aura + 1 }; break
          case 'auraTick':     upgrade = { auraTick: s.auraTick + 1 }; break
          case 'auraRange':    upgrade = { auraRange: Math.min(3, s.auraRange + 1) }; break
          case 'orbital':      upgrade = { orbital: s.orbital + 1 }; break
          case 'orbSpeed':     upgrade = { orbSpeed: Math.min(3, s.orbSpeed + 1) }; break
          case 'orbPower':     upgrade = { orbPower: Math.min(3, s.orbPower + 1) }; break
          case 'orbRange':     upgrade = { orbRange: Math.min(2, s.orbRange + 1) }; break
          case 'wand':         upgrade = { wand: true }; break
          case 'boomerang':    upgrade = { boomerang: true }; break
          case 'flameTrail':   upgrade = { flameTrail: true }; break
          case 'bloodNova':    upgrade = { bloodNova: true }; break
          case 'bloodNovaCD':  upgrade = { bloodNovaCD: Math.min(4, s.bloodNovaCD + 1) }; break
          case 'vampiric':     upgrade = { vampiric: true }; break
          case 'lightning':         upgrade = { lightning: true }; break
          case 'lightningTargets':  upgrade = { lightningTargets: Math.min(2, s.lightningTargets + 1) }; break
          case 'lightningCooldown': upgrade = { lightningCooldown: Math.min(2, s.lightningCooldown + 1) }; break
          case 'axe':          upgrade = { axe: true }; break
          case 'axeAmount':    upgrade = { axeAmount: Math.min(2, s.axeAmount + 1) }; break
          case 'axeDamage':    upgrade = { axeDamage: Math.min(1, s.axeDamage + 1) }; break
          case 'axePierce':    upgrade = { axePierce: Math.min(1, s.axePierce + 1) }; break
          case 'axeEvolution': upgrade = { axeEvolution: true }; break
          case 'divineShield': upgrade = { divineShield: true }; break
          case 'xpGain':       upgrade = { xpGain: Math.min(5, s.xpGain + 1) }; break
          case 'magnetRange':  upgrade = { magnetRange: Math.min(3, s.magnetRange + 1) }; break
          case 'might':        upgrade = { might: s.might + 0.1, mightPicks: Math.min(5, s.mightPicks + 1) }; break
          case 'equinox':      upgrade = { equinox: true }; break
          case 'solstice':     upgrade = { solstice: true }; break
          case 'dualGunDamage':upgrade = { dualGunDamage: Math.min(3, s.dualGunDamage + 1) }; break
          case 'dualGunSpeed': upgrade = { dualGunSpeed: Math.min(2, s.dualGunSpeed + 1), dualGunAttackInterval: Math.max(500, Math.floor(s.dualGunAttackInterval * 0.8)) }; break
          case 'dualGunExtra': upgrade = { dualGunExtra: Math.min(2, s.dualGunExtra + 1) }; break
          case 'echo':         upgrade = { echo: Math.min(2, s.echo + 1) }; break
          case 'ravens':       upgrade = { ravens: true }; break
          case 'ravensCD':     upgrade = { ravensCD: Math.min(3, s.ravensCD + 1) }; break
          case 'ravensPower':  upgrade = { ravensPower: Math.min(3, s.ravensPower + 1) }; break
          case 'ravensCount':  upgrade = { ravensCount: Math.min(2, s.ravensCount + 1) }; break
          case 'spear':         upgrade = { spear: true }; break
          case 'spearCount':    upgrade = { spearCount: Math.min(5, s.spearCount + 1) }; break
          case 'spearInterval': upgrade = { spearInterval: Math.min(3, s.spearInterval + 1) }; break
          case 'spearPierce':   upgrade = { spearPierce: Math.min(2, s.spearPierce + 1) }; break
          case 'spearSpeed':    upgrade = { spearSpeed: Math.min(5, s.spearSpeed + 1) }; break
          case 'spearStorm':    upgrade = { spearStorm: true }; break
          case 'meleeRange':   upgrade = { meleeRange: Math.min(4, s.meleeRange + 1) }; break
          case 'meleeSpeed':   upgrade = { meleeSpeed: Math.min(4, s.meleeSpeed + 1), attackInterval: Math.max(250, Math.floor(950 * Math.pow(0.85, s.meleeSpeed + 1))) }; break
          case 'meleeDamage':  upgrade = { meleeDamage: Math.min(4, s.meleeDamage + 1) }; break
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
    might:          Math.min(4.0, Math.max(1.0, s.might)),
    attackInterval:     Math.max(250, s.attackInterval),
    wandAttackInterval: Math.max(250, s.wandAttackInterval),
    multiShot:      Math.min(4, Math.max(0, Math.floor(s.multiShot))),
    aura:           Math.min(1, Math.max(0, Math.floor(s.aura))),
    auraTick:       Math.min(3, Math.max(0, Math.floor(s.auraTick))),
    auraRange:      Math.min(3, Math.max(0, Math.floor(s.auraRange))),
    orbital:            Math.min(5, Math.max(0, Math.floor(s.orbital))),
    orbSpeed:           Math.min(3, Math.max(0, Math.floor(s.orbSpeed))),
    orbPower:           Math.min(3, Math.max(0, Math.floor(s.orbPower))),
    orbRange:           Math.min(2, Math.max(0, Math.floor(s.orbRange))),
    lightningTargets:   Math.min(2, Math.max(0, Math.floor(s.lightningTargets))),
    lightningCooldown:  Math.min(2, Math.max(0, Math.floor(s.lightningCooldown))),
    bloodNovaCD:        Math.min(4, Math.max(0, Math.floor(s.bloodNovaCD))),
    moveSpeed:          Math.min(240, Math.max(50, s.moveSpeed)),
    magnetRange:        Math.min(3, Math.max(0, Math.floor(s.magnetRange))),
    dualGunDamage:      Math.min(3, Math.max(0, Math.floor(s.dualGunDamage))),
    dualGunSpeed:       Math.min(2, Math.max(0, Math.floor(s.dualGunSpeed))),
    dualGunAttackInterval: Math.max(500, s.dualGunAttackInterval),
    dualGunExtra:          Math.min(2, Math.max(0, Math.floor(s.dualGunExtra))),
    echo:               Math.min(2, Math.max(0, Math.floor(s.echo))),
    ravensCD:           Math.min(3, Math.max(0, Math.floor(s.ravensCD))),
    ravensPower:        Math.min(3, Math.max(0, Math.floor(s.ravensPower))),
    ravensCount:        Math.min(2, Math.max(0, Math.floor(s.ravensCount))),
    spearCount:         Math.min(5, Math.max(0, Math.floor(s.spearCount ?? 0))),
    spearInterval:      Math.min(3, Math.max(0, Math.floor(s.spearInterval ?? 0))),
    spearPierce:        Math.min(2, Math.max(0, Math.floor(s.spearPierce ?? 0))),
    spearSpeed:         Math.min(5, Math.max(0, Math.floor(s.spearSpeed ?? 0))),
    spearStorm:         !!s.spearStorm,
    axeAmount:          Math.min(2, Math.max(0, Math.floor(s.axeAmount ?? 0))),
    axeDamage:          Math.min(1, Math.max(0, Math.floor(s.axeDamage ?? 0))),
    axePierce:          Math.min(1, Math.max(0, Math.floor(s.axePierce ?? 0))),
    axeEvolution:       !!s.axeEvolution,
    meleeRange:         Math.min(4, Math.max(0, Math.floor(s.meleeRange ?? 0))),
    meleeArc:           Math.min(1, Math.max(0, Math.floor(s.meleeArc ?? 0))),
    meleeSpeed:         Math.min(4, Math.max(0, Math.floor(s.meleeSpeed ?? 0))),
    meleeDamage:        Math.min(4, Math.max(0, Math.floor(s.meleeDamage ?? 0))),
  }
}
