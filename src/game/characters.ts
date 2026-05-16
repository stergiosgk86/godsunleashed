export type CharacterType = 'knight' | 'rogue' | 'witch' | 'vampire'

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
  mightMult: number
  bonusMoveSpeed: number
  attackIntervalMult: number
  dashCooldownMult: number
  bonusDashDistance: number
  bonusHpRegen: number
  startAura: number
  lifeDrain: number
}

export const CHARACTER_DEFS: Record<CharacterType, CharacterDef> = {
  knight: {
    id: 'knight', name: 'Knight', trait: 'Steadfast',
    description: 'Balanced in all aspects. A solid choice for any run.',
    spriteKey: 'player', color: '#4488ff',
    statLines: [{ label: 'No bonuses or penalties', positive: true }],
    bonusMaxHp: 0, mightMult: 1.0, bonusMoveSpeed: 0,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 0, lifeDrain: 0,
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
    bonusMaxHp: -20, mightMult: 0.9, bonusMoveSpeed: 50,
    attackIntervalMult: 1.0, dashCooldownMult: 0.55, bonusDashDistance: 0.5,
    bonusHpRegen: 0, startAura: 0, lifeDrain: 0,
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
    bonusMaxHp: -15, mightMult: 1.1, bonusMoveSpeed: -30,
    attackIntervalMult: 0.78, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0, startAura: 1, lifeDrain: 0,
  },
  vampire: {
    id: 'vampire', name: 'Vampire', trait: 'Life Drain',
    description: 'Heals on every kill. Large HP pool. Less base damage.',
    spriteKey: 'char_vampire', color: '#cc2222',
    statLines: [
      { label: '+60 Max HP',           positive: true  },
      { label: '+2 HP per kill',       positive: true  },
      { label: '+0.2 HP/sec regen',    positive: true  },
      { label: '-15% Might',           positive: false },
    ],
    bonusMaxHp: 60, mightMult: 0.85, bonusMoveSpeed: 0,
    attackIntervalMult: 1.0, dashCooldownMult: 1.0, bonusDashDistance: 0,
    bonusHpRegen: 0.2, startAura: 0, lifeDrain: 2,
  },
}

export const ALL_CHARACTERS: CharacterType[] = ['knight', 'rogue', 'witch', 'vampire']
