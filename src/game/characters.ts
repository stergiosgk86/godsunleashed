export type CharacterType = 'ares' | 'freyja' | 'witch' | 'shade' | 'zeus' | 'poseidon' | 'apollo' | 'hades' | 'chronos' | 'odin' | 'heimdall'

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
  startWand: boolean
  startEquinox: boolean
  startSolstice: boolean
  startRavens: boolean
  startSpear: boolean
  // Only fires at enemies within a ~140° arc in the facing direction
  frontArcOnly: boolean
  // In-game sprite scale (default 1.5 for 32×32 sprites)
  scale: number
  // Menu sprite display overrides (for non-32×32 spritesheets)
  menuFrame?: { fw: number; fh: number; sw: number; sh: number }
  // Which row of the spritesheet to show in the character select menu (default 0)
  menuRow?: number
  // True for characters loaded as a single static image (no walk animation frames)
  staticSprite?: boolean
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
    startFlameTrail: false, startOrbital: 0, startWand: false, startEquinox: false, startSolstice: false, startRavens: false, startSpear: false, frontArcOnly: true,
    scale: 1.0,
  },
  freyja: {
    id: 'freyja', name: 'Freyja', trait: 'Seiðr Witch',
    description: 'Goddess of Love and War. Wields the ancient magic of Seiðr — hurls enchanted boomerangs with arcane might and passive regeneration.',
    spriteKey: 'char_freyja', color: '#ffaa22',
    statLines: [
      { label: 'Weapon: Boomerang',  positive: true  },
      { label: '+20% Might',         positive: true  },
      { label: '+0.2 HP/sec regen',  positive: true  },
      { label: '+10 Move Speed',     positive: true  },
    ],
    bonusMaxHp: 0, baseArmor: 0, mightMult: 1.2, bonusMoveSpeed: 10,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0.2, startAura: 0, lifeDrain: 0, startLightning: false, startBoomerang: true,
    startFlameTrail: false, startOrbital: 0, startWand: false, startEquinox: false, startSolstice: false, startRavens: false, startSpear: false, frontArcOnly: false,
    scale: 0.75,
    menuFrame: { fw: 96, fh: 96, sw: 288, sh: 384 },
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
    startFlameTrail: false, startOrbital: 0, startWand: false, startEquinox: false, startSolstice: false, startRavens: false, startSpear: false, frontArcOnly: false,
    scale: 1.5,
  },
  shade: {
    id: 'shade', name: 'Shade', trait: 'Cursed Ground',
    description: 'Leaves a burning trail as they move. Heals on kills. Durable but less damage.',
    spriteKey: 'char_shade', color: '#ff7722',
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
    startFlameTrail: true, startOrbital: 0, startWand: false, startEquinox: false, startSolstice: false, startRavens: false, startSpear: false, frontArcOnly: false,
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
    startFlameTrail: false, startOrbital: 0, startWand: false, startEquinox: false, startSolstice: false, startRavens: false, startSpear: false, frontArcOnly: false,
    scale: 0.8,
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
    startFlameTrail: false, startOrbital: 1, startWand: false, startEquinox: false, startSolstice: false, startRavens: false, startSpear: false, frontArcOnly: false,
    scale: 0.9,
    menuFrame: { fw: 96, fh: 96, sw: 288, sh: 384 },
  },
  apollo: {
    id: 'apollo', name: 'Apollo', trait: 'Solar Archer',
    description: 'God of the Sun. Fires enchanted arcane bolts with precision and radiant might.',
    spriteKey: 'char_apollo', color: '#ff9933',
    statLines: [
      { label: 'Weapon: Arcane Wand',  positive: true  },
      { label: '+20% Might',           positive: true  },
      { label: '20% faster Wand',      positive: true  },
      { label: '+10 Max HP',           positive: true  },
      { label: '+0.15 HP/sec regen',   positive: true  },
      { label: '-10 Move Speed',       positive: false },
    ],
    bonusMaxHp: 10, baseArmor: 0, mightMult: 1.2, bonusMoveSpeed: -10,
    attackIntervalMult: 0.8, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0.15, startAura: 0, lifeDrain: 0, startLightning: false, startBoomerang: false,
    startFlameTrail: false, startOrbital: 0, startWand: true, startEquinox: false, startSolstice: false, startRavens: false, startSpear: false, frontArcOnly: false,
    scale: 0.75,
    menuFrame: { fw: 96, fh: 96, sw: 288, sh: 384 },
    menuRow: 1,
  },
  hades: {
    id: 'hades', name: 'Hades', trait: 'Lord of Souls',
    description: 'God of the Underworld. Radiates a death aura that consumes enemies. Drains their souls on kill.',
    spriteKey: 'char_hades', color: '#5544dd',
    statLines: [
      { label: 'Weapon: Aura',       positive: true  },
      { label: '+30% Might',         positive: true  },
      { label: '+80 Max HP',         positive: true  },
      { label: '3 Armor',            positive: true  },
      { label: '+4 HP per kill',     positive: true  },
      { label: '-50 Move Speed',     positive: false },
    ],
    bonusMaxHp: 80, baseArmor: 3, mightMult: 1.3, bonusMoveSpeed: -50,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 1, lifeDrain: 4, startLightning: false, startBoomerang: false,
    startFlameTrail: false, startOrbital: 0, startWand: false, startEquinox: false, startSolstice: false, startRavens: false, startSpear: false, frontArcOnly: false,
    scale: 0.75,
    menuFrame: { fw: 96, fh: 96, sw: 288, sh: 384 },
    menuRow: 1,
  },
  chronos: {
    id: 'chronos', name: 'Chronos', trait: 'Dual Sunrays',
    description: 'God of Time. Commands the flow of battle — sunrays blaze in all four directions, endlessly.',
    spriteKey: 'char_chronos', color: '#22ddcc',
    statLines: [
      { label: 'Weapon: Equinox',    positive: true  },
      { label: 'Weapon: Solstice',  positive: true  },
      { label: '+10% Might',        positive: true  },
      { label: '+15 Move Speed',    positive: true  },
      { label: '+0.2 HP/sec regen', positive: true  },
    ],
    bonusMaxHp: 0, baseArmor: 0, mightMult: 1.1, bonusMoveSpeed: 15,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0.2, startAura: 0, lifeDrain: 0, startLightning: false, startBoomerang: false,
    startFlameTrail: false, startOrbital: 0, startWand: false, startEquinox: true, startSolstice: true, startRavens: false, startSpear: false, frontArcOnly: false,
    scale: 0.65,
    menuFrame: { fw: 80, fh: 80, sw: 240, sh: 320 },
    menuRow: 1,
  },
  odin: {
    id: 'odin', name: 'Odin', trait: 'Allfather\'s Ravens',
    description: 'Allfather of the Norse gods. Commands Huginn and Muninn — twin ravens that unleash bomb barrages from orbiting zones.',
    spriteKey: 'char_odin', color: '#aabbff',
    statLines: [
      { label: 'Weapon: Odin\'s Ravens', positive: true  },
      { label: '+25% Might',             positive: true  },
      { label: '+20 Max HP',             positive: true  },
      { label: '1 Armor',                positive: true  },
      { label: '+0.2 HP/sec regen',      positive: true  },
      { label: '-20 Move Speed',         positive: false },
    ],
    bonusMaxHp: 20, baseArmor: 1, mightMult: 1.25, bonusMoveSpeed: -20,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0.2, startAura: 0, lifeDrain: 0, startLightning: false, startBoomerang: false,
    startFlameTrail: false, startOrbital: 0, startWand: false, startEquinox: false, startSolstice: false, startRavens: true, startSpear: false, frontArcOnly: false,
    scale: 0.19,
    menuFrame: { fw: 60, fh: 80, sw: 180, sh: 320 },
    menuRow: 1,
  },
  heimdall: {
    id: 'heimdall', name: 'Heimdall', trait: 'Bifrost Warden',
    description: 'Watchman of the gods. Hurls piercing Bifrost spears in the direction you move, skewering all enemies in their path.',
    spriteKey: 'char_heimdall', color: '#00ddff',
    statLines: [
      { label: 'Weapon: Bifrost Spear', positive: true  },
      { label: '+10% Might',            positive: true  },
      { label: '+15 Move Speed',        positive: true  },
      { label: 'Spears pierce all',     positive: true  },
    ],
    bonusMaxHp: 0, baseArmor: 0, mightMult: 1.1, bonusMoveSpeed: 15,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 0, lifeDrain: 0, startLightning: false, startBoomerang: false,
    startFlameTrail: false, startOrbital: 0, startWand: false, startEquinox: false, startSolstice: false, startRavens: false, startSpear: true, frontArcOnly: false,
    scale: 0.75,
    menuFrame: { fw: 96, fh: 96, sw: 288, sh: 384 },
  },
}

export const ALL_CHARACTERS: CharacterType[] = ['ares', 'freyja', 'witch', 'shade', 'zeus', 'poseidon', 'apollo', 'hades', 'chronos', 'odin', 'heimdall']
