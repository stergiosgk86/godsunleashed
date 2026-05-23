export type CharacterType = 'ares' | 'rogue' | 'witch' | 'shade' | 'zeus' | 'poseidon'

export interface CharacterDef {
  id: CharacterType
  name: string
  trait: string
  description: string
  spriteKey: string
  color: string
  statLines: Array<{ label: string; positive: boolean }>
  // Applied in startRun() on top of meta upgrades
  bonusMaxHp: number
  baseArmor: number
  mightMult: number
  bonusMoveSpeed: number
  attackIntervalMult: number
  dashCooldownMult: number
  bonusDashDistance: number
  bonusHpRegen: number
  startAura: number
  lifeDrain: number
  startLightning: boolean
  startBoomerang: boolean
  startFlameTrail: boolean
  startOrbital: number
  // Only fires at enemies within a ~140° arc in the facing direction
  frontArcOnly: boolean
  // In-game sprite scale (default 1.5 for 32×32 sprites)
  scale: number
  // Menu sprite display overrides (for non-32×32 spritesheets)
  menuFrame?: { fw: number; fh: number; sw: number; sh: number }
}

export const CHARACTER_DEFS: Record<CharacterType, CharacterDef> = {
  ares: {
    id: 'ares', name: 'Ares', trait: 'Vanguard Strike',
    description: 'God of War. Devastating frontal power — but can only strike enemies ahead.',
    spriteKey: 'char_ares', color: '#dd3311',
    statLines: [
      { label: 'Weapon: Melee Arc',    positive: true  },
      { label: '+50% Might',           positive: true  },
      { label: '1 Armor',              positive: true  },
      { label: '+30 Move Speed',       positive: true  },
      { label: '+50 Max HP',           positive: true  },
      { label: 'Front Arc Only',       positive: false },
    ],
    bonusMaxHp: 50, baseArmor: 1, mightMult: 1.5, bonusMoveSpeed: 30,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 0, lifeDrain: 0, startLightning: false, startBoomerang: false,
    startFlameTrail: false, startOrbital: 0, frontArcOnly: true,
    scale: 0.85,
  },
  rogue: {
    id: 'rogue', name: 'Rogue', trait: 'Shadow Step',
    description: 'Master of mobility. Hurls a boomerang, dashes further and cools down faster. Fragile.',
    spriteKey: 'char_rogue', color: '#44cc66',
    statLines: [
      { label: 'Weapon: Boomerang',    positive: true  },
      { label: '+50 Move Speed',       positive: true  },
      { label: '+0.5 Dash Distance',   positive: true  },
      { label: '45% shorter Dash CD',  positive: true  },
      { label: '-20 Max HP',           positive: false },
      { label: '-10% Might',           positive: false },
    ],
    bonusMaxHp: -20, baseArmor: 0, mightMult: 0.9, bonusMoveSpeed: 50,
    attackIntervalMult: 1.0, dashCooldownMult: 0.55, bonusDashDistance: 0.5,
    bonusHpRegen: 0, startAura: 0, lifeDrain: 0, startLightning: false, startBoomerang: true,
    startFlameTrail: false, startOrbital: 0, frontArcOnly: false,
    scale: 1.5,
  },
  witch: {
    id: 'witch', name: 'Witch', trait: 'Arcane Mastery',
    description: 'Begins with an Aura that pulses damage to all nearby enemies. Slower.',
    spriteKey: 'char_witch', color: '#cc44ff',
    statLines: [
      { label: 'Weapon: Aura',         positive: true  },
      { label: '+10% Might',           positive: true  },
      { label: '-30 Move Speed',       positive: false },
      { label: '-15 Max HP',           positive: false },
    ],
    bonusMaxHp: -15, baseArmor: 0, mightMult: 1.1, bonusMoveSpeed: -30,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 1, lifeDrain: 0, startLightning: false, startBoomerang: false,
    startFlameTrail: false, startOrbital: 0, frontArcOnly: false,
    scale: 1.5,
  },
  shade: {
    id: 'shade', name: 'Shade', trait: 'Cursed Ground',
    description: 'Leaves a burning trail as they move. Heals on kills. Durable but less damage.',
    spriteKey: 'char_shade', color: '#cc2222',
    statLines: [
      { label: 'Weapon: Flame Trail',  positive: true  },
      { label: '+60 Max HP',           positive: true  },
      { label: '2 Armor',              positive: true  },
      { label: '+2 HP per kill',       positive: true  },
      { label: '-15% Might',           positive: false },
    ],
    bonusMaxHp: 60, baseArmor: 2, mightMult: 0.85, bonusMoveSpeed: 0,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 0, lifeDrain: 2, startLightning: false, startBoomerang: false,
    startFlameTrail: true, startOrbital: 0, frontArcOnly: false,
    scale: 1.5,
  },
  zeus: {
    id: 'zeus', name: 'Zeus', trait: 'Storm Lord',
    description: 'King of Olympus. Calls lightning from the sky. Devastating might but slow.',
    spriteKey: 'char_zeus', color: '#ffd700',
    statLines: [
      { label: 'Weapon: Lightning',    positive: true  },
      { label: '+40% Might',           positive: true  },
      { label: '+0.3 HP/sec regen',    positive: true  },
      { label: '+10 Max HP',           positive: true  },
      { label: '-40 Move Speed',       positive: false },
    ],
    bonusMaxHp: 10, baseArmor: 0, mightMult: 1.4, bonusMoveSpeed: -40,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0.3, startAura: 0, lifeDrain: 0, startLightning: true, startBoomerang: false,
    startFlameTrail: false, startOrbital: 0, frontArcOnly: false,
    scale: 1.0,
    menuFrame: { fw: 96, fh: 96, sw: 288, sh: 768 },
  },
  poseidon: {
    id: 'poseidon', name: 'Poseidon', trait: 'Trident of the Deep',
    description: 'God of the Sea. A Spirit Orb circles and strikes nearby enemies. Durable.',
    spriteKey: 'char_poseidon', color: '#1188dd',
    statLines: [
      { label: 'Weapon: Spirit Orb',   positive: true  },
      { label: '+15% Might',           positive: true  },
      { label: '+25 Max HP',           positive: true  },
      { label: '1 Armor',              positive: true  },
      { label: '-30 Move Speed',       positive: false },
    ],
    bonusMaxHp: 25, baseArmor: 1, mightMult: 1.15, bonusMoveSpeed: -30,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 0, lifeDrain: 0, startLightning: false, startBoomerang: false,
    startFlameTrail: false, startOrbital: 1, frontArcOnly: false,
    scale: 1.0,
    menuFrame: { fw: 96, fh: 96, sw: 288, sh: 384 },
  },
}

export const ALL_CHARACTERS: CharacterType[] = ['ares', 'rogue', 'witch', 'shade', 'zeus', 'poseidon']
