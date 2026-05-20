export type CharacterType = 'knight' | 'rogue' | 'witch' | 'shade' | 'zeus' | 'ares'

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
  // Only fires at enemies within a ~140° arc in the facing direction
  frontArcOnly: boolean
  // In-game sprite scale (default 1.5 for 32×32 sprites)
  scale: number
  // Menu sprite display overrides (for non-32×32 spritesheets)
  menuFrame?: { fw: number; fh: number; sw: number; sh: number }
}

export const CHARACTER_DEFS: Record<CharacterType, CharacterDef> = {
  knight: {
    id: 'knight', name: 'Knight', trait: 'Steadfast',
    description: 'Balanced in all aspects. A solid choice for any run.',
    spriteKey: 'player', color: '#4488ff',
    statLines: [
      { label: '1 Armor',                positive: true },
      { label: 'No other bonuses',        positive: true },
    ],
    bonusMaxHp: 0, baseArmor: 1, mightMult: 1.0, bonusMoveSpeed: 0,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 0, lifeDrain: 0, startLightning: false, frontArcOnly: false,
    scale: 1.5,
  },
  rogue: {
    id: 'rogue', name: 'Rogue', trait: 'Shadow Step',
    description: 'Master of mobility. Dashes further, cools down faster. Fragile.',
    spriteKey: 'char_rogue', color: '#44cc66',
    statLines: [
      { label: '+50 Move Speed',       positive: true  },
      { label: '+0.5 Dash Distance',   positive: true  },
      { label: '45% shorter Dash CD',  positive: true  },
      { label: '-20 Max HP',           positive: false },
      { label: '-10% Might',           positive: false },
    ],
    bonusMaxHp: -20, baseArmor: 0, mightMult: 0.9, bonusMoveSpeed: 50,
    attackIntervalMult: 1.0, dashCooldownMult: 0.55, bonusDashDistance: 0.5,
    bonusHpRegen: 0, startAura: 0, lifeDrain: 0, startLightning: false, frontArcOnly: false,
    scale: 1.5,
  },
  witch: {
    id: 'witch', name: 'Witch', trait: 'Arcane Mastery',
    description: 'Begins with an Aura, attacks faster, deals more damage. Slower.',
    spriteKey: 'char_witch', color: '#cc44ff',
    statLines: [
      { label: '+10% Might',           positive: true  },
      { label: '22% faster attacks',   positive: true  },
      { label: 'Starts with Aura Lv1', positive: true  },
      { label: '-30 Move Speed',       positive: false },
      { label: '-15 Max HP',           positive: false },
    ],
    bonusMaxHp: -15, baseArmor: 0, mightMult: 1.1, bonusMoveSpeed: -30,
    attackIntervalMult: 0.78, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 1, lifeDrain: 0, startLightning: false, frontArcOnly: false,
    scale: 1.5,
  },
  shade: {
    id: 'shade', name: 'Shade', trait: 'Life Drain',
    description: 'Heals on every kill. Large HP pool. Less base damage.',
    spriteKey: 'char_shade', color: '#cc2222',
    statLines: [
      { label: '+60 Max HP',           positive: true  },
      { label: '2 Armor',              positive: true  },
      { label: '+2 HP per kill',       positive: true  },
      { label: '+0.2 HP/sec regen',    positive: true  },
      { label: '-15% Might',           positive: false },
    ],
    bonusMaxHp: 60, baseArmor: 2, mightMult: 0.85, bonusMoveSpeed: 0,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0.2, startAura: 0, lifeDrain: 2, startLightning: false, frontArcOnly: false,
    scale: 1.5,
  },
  zeus: {
    id: 'zeus', name: 'Zeus', trait: 'Storm Lord',
    description: 'King of Olympus. Commands thunder from birth. Slower but devastating.',
    spriteKey: 'char_zeus', color: '#ffd700',
    statLines: [
      { label: '+20% Might',                  positive: true  },
      { label: 'Starts with Thunder Strike',  positive: true  },
      { label: '+10 Max HP',                  positive: true  },
      { label: '-40 Move Speed',              positive: false },
    ],
    bonusMaxHp: 10, baseArmor: 0, mightMult: 1.2, bonusMoveSpeed: -40,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 0, lifeDrain: 0, startLightning: true, frontArcOnly: false,
    scale: 1.0,
    menuFrame: { fw: 96, fh: 96, sw: 288, sh: 768 },
  },
  ares: {
    id: 'ares', name: 'Ares', trait: 'Vanguard Strike',
    description: 'God of War. Devastating frontal power — but can only strike enemies ahead.',
    spriteKey: 'char_ares', color: '#dd3311',
    statLines: [
      { label: '+50% Might',          positive: true  },
      { label: '1 Armor',             positive: true  },
      { label: '+30 Move Speed',       positive: true  },
      { label: 'Front Arc Only',       positive: false },
      { label: '-10 Max HP',           positive: false },
    ],
    bonusMaxHp: -10, baseArmor: 1, mightMult: 1.5, bonusMoveSpeed: 30,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 0, lifeDrain: 0, startLightning: false, frontArcOnly: true,
    scale: 1.5,
  },
}

export const ALL_CHARACTERS: CharacterType[] = ['knight', 'rogue', 'witch', 'shade', 'zeus', 'ares']
