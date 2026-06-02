export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
}

export interface AchievementCategory {
  label: string
  color: string
  ids: string[]
}

export const ACHIEVEMENTS: Achievement[] = [
  // Survival
  { id: 'initiate',       name: 'Initiate',       description: 'Survive for 1 minute',                    icon: '▸' },
  { id: 'survivor_3',     name: 'Steadfast',       description: 'Survive for 3 minutes',                   icon: '▷' },
  { id: 'survivor_5',     name: 'Survivor',        description: 'Survive for 5 minutes',                   icon: '▶' },
  { id: 'survivor_10',    name: 'Ironwilled',      description: 'Survive for 10 minutes',                  icon: '◓' },
  { id: 'survivor_15',    name: 'Enduring',        description: 'Survive for 15 minutes',                  icon: '◐' },
  { id: 'veteran',        name: 'Veteran',         description: 'Survive for 30 minutes (full run)',        icon: '◈' },
  // Kills
  { id: 'first_blood',    name: 'First Blood',     description: 'Kill your first enemy',                   icon: '◂' },
  { id: 'bloodthirsty',   name: 'Bloodthirsty',    description: 'Kill 50 enemies in one run',              icon: '▹' },
  { id: 'hunter',         name: 'Hunter',          description: 'Kill 100 enemies in one run',             icon: '►' },
  { id: 'veteran_hunter', name: 'Relentless',      description: 'Kill 250 enemies in one run',             icon: '◁' },
  { id: 'slaughterer',    name: 'Slaughterer',     description: 'Kill 500 enemies in one run',             icon: '◆' },
  { id: 'annihilator',    name: 'Annihilator',     description: 'Kill 1,000 enemies in one run',           icon: '❖' },
  // Bosses
  { id: 'boss_slayer',    name: 'Boss Slayer',     description: 'Defeat your first boss',                  icon: '⚔' },
  { id: 'boss_hunter',    name: 'Boss Hunter',     description: 'Defeat 3 bosses in one run',              icon: '◬' },
  { id: 'boss_bane',      name: 'Boss Bane',       description: 'Defeat 5 bosses in one run',              icon: '☆' },
  { id: 'god_slayer',     name: 'God Slayer',      description: 'Defeat the final boss and win',           icon: '☠' },
  // Damage
  { id: 'damage_1k',      name: 'Brawler',         description: 'Deal 1,000 damage in one run',            icon: '✧' },
  { id: 'destroyer',      name: 'Destroyer',       description: 'Deal 10,000 damage in one run',           icon: '✦' },
  { id: 'damage_50k',     name: 'Devastator',      description: 'Deal 50,000 damage in one run',           icon: '✩' },
  { id: 'berserker',      name: 'Berserker',       description: 'Deal 100,000 damage in one run',          icon: '✸' },
  { id: 'damage_500k',    name: 'Cataclysm',       description: 'Deal 500,000 damage in one run',          icon: '✵' },
  { id: 'juggernaut',     name: 'Juggernaut',      description: 'Deal 1,000,000 damage in one run',        icon: '⬟' },
  // Coins
  { id: 'coin_collector', name: 'Coin Collector',  description: 'Collect 50 coins in one run',             icon: '◌' },
  { id: 'wealthy',        name: 'Wealthy',         description: 'Collect 100 coins in one run',            icon: '◎' },
  { id: 'coin_250',       name: 'Affluent',        description: 'Collect 250 coins in one run',            icon: '⬠' },
  { id: 'coin_hoarder',   name: 'Coin Hoarder',    description: 'Collect 500 coins in one run',            icon: '⬡' },
  // Leveling
  { id: 'level_3',        name: 'Rising',          description: 'Reach level 3 in one run',                icon: '▵' },
  { id: 'quick_learner',  name: 'Quick Learner',   description: 'Reach level 5 in one run',                icon: '▴' },
  { id: 'ascendant',      name: 'Ascendant',       description: 'Reach level 10 in one run',               icon: '▲' },
  { id: 'transcendent',   name: 'Transcendent',    description: 'Reach level 20 in one run',               icon: '△' },
  { id: 'legendary',      name: 'Legendary',       description: 'Reach level 30 in one run',               icon: '✪' },
  // Weapons & Build
  { id: 'weapon_hoarder',  name: 'Armed',              description: 'Have 3 or more weapons active',                                   icon: '⊙' },
  { id: 'arsenal',         name: 'Arsenal',            description: 'Have 5 or more weapons active',                                   icon: '⊕' },
  { id: 'all_weapons',     name: 'Omniarmed',          description: 'Have all 8 weapons active simultaneously',                        icon: '⬢' },
  { id: 'evolution_spear', name: 'Thousand Spears',    description: 'Max the Bifrost Spear tree in a single run to unlock the evolution', icon: '◆' },
  { id: 'evolution_axe',   name: "Berserker's Ring",   description: "Max the Mjölnir tree in a single run to unlock the evolution",    icon: '🪓' },
  // Win conditions
  { id: 'full_health',    name: 'Unscathed',       description: 'Win a run with full HP remaining',        icon: '◍' },
  { id: 'untouchable',    name: 'Untouchable',     description: 'Win a full run without taking damage',    icon: '○' },
  { id: 'glass_cannon',   name: 'Glass Cannon',    description: 'Win a run with 10% HP or less',           icon: '◇' },
  // Multiplayer
  { id: 'team_player',    name: 'Team Player',     description: 'Complete a multiplayer game',             icon: '◉' },
  { id: 'champions',      name: 'Champions',       description: 'Win a multiplayer run',                   icon: '★' },
  // Characters — 5 min
  { id: 'char_ares_5',      name: "War's Trial",         description: 'Survive 5 minutes as Ares',      icon: '◇' },
  { id: 'char_freyja_5',    name: "Seiðr's Trial",       description: 'Survive 5 minutes as Freyja',    icon: '◇' },
  { id: 'char_heimdall_5',  name: "Warden's Trial",      description: 'Survive 5 minutes as Heimdall',  icon: '◇' },
  { id: 'char_thor_5',      name: "Thunder's Trial",     description: 'Survive 5 minutes as Thor',      icon: '◇' },
  { id: 'char_poseidon_5',  name: "Trident's Trial",     description: 'Survive 5 minutes as Poseidon',  icon: '◇' },
  { id: 'char_apollo_5',    name: 'Solar Trial',         description: 'Survive 5 minutes as Apollo',    icon: '◇' },
  { id: 'char_zeus_5',      name: "Storm's Trial",       description: 'Survive 5 minutes as Zeus',      icon: '◇' },
  { id: 'char_chronos_5',   name: "Time's Trial",        description: 'Survive 5 minutes as Chronos',   icon: '◇' },
  { id: 'char_odin_5',      name: "Allfather's Trial",   description: 'Survive 5 minutes as Odin',      icon: '◇' },
  { id: 'char_hades_5',     name: "Soul Reaper's Trial", description: 'Survive 5 minutes as Hades',     icon: '◇' },
  // Characters — 15 min
  { id: 'char_ares_15',     name: "War's Fury",          description: 'Survive 15 minutes as Ares',     icon: '◆' },
  { id: 'char_freyja_15',   name: "Seiðr's Power",       description: 'Survive 15 minutes as Freyja',   icon: '◆' },
  { id: 'char_heimdall_15', name: "Warden's Watch",      description: 'Survive 15 minutes as Heimdall', icon: '◆' },
  { id: 'char_thor_15',     name: "Thunder's Fury",      description: 'Survive 15 minutes as Thor',     icon: '◆' },
  { id: 'char_poseidon_15', name: "Trident's Fury",      description: 'Survive 15 minutes as Poseidon', icon: '◆' },
  { id: 'char_apollo_15',   name: 'Solar Path',          description: 'Survive 15 minutes as Apollo',   icon: '◆' },
  { id: 'char_zeus_15',     name: "Storm Lord's Path",   description: 'Survive 15 minutes as Zeus',     icon: '◆' },
  { id: 'char_chronos_15',  name: 'Temporal Path',       description: 'Survive 15 minutes as Chronos',  icon: '◆' },
  { id: 'char_odin_15',     name: "Allfather's Path",    description: 'Survive 15 minutes as Odin',     icon: '◆' },
  { id: 'char_hades_15',    name: "Soul Reaper's Path",  description: 'Survive 15 minutes as Hades',    icon: '◆' },
  // Characters — 30 min (high-cost + achievement-locked characters only)
  { id: 'char_poseidon_30', name: "Trident's Dominion",  description: 'Survive 30 minutes as Poseidon', icon: '✦' },
  { id: 'char_apollo_30',   name: 'Solar Mastery',       description: 'Survive 30 minutes as Apollo',   icon: '✦' },
  { id: 'char_zeus_30',     name: "Storm Lord's Reign",  description: 'Survive 30 minutes as Zeus',     icon: '✦' },
  { id: 'char_chronos_30',  name: 'Master of Time',      description: 'Survive 30 minutes as Chronos',  icon: '✦' },
  { id: 'char_odin_30',     name: "Allfather's Wisdom",  description: 'Survive 30 minutes as Odin',     icon: '✦' },
  { id: 'char_hades_30',    name: 'Lord of the Dead',    description: 'Survive 30 minutes as Hades',    icon: '✦' },
  { id: 'char_thor_30',    name: "Mjölnir's Reign",     description: 'Survive 30 minutes as Thor',     icon: '✦' },
]

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  { label: 'SURVIVAL',    color: '#44aaff', ids: ['initiate', 'survivor_3', 'survivor_5', 'survivor_10', 'survivor_15', 'veteran'] },
  { label: 'KILLS',       color: '#ff6644', ids: ['first_blood', 'bloodthirsty', 'hunter', 'veteran_hunter', 'slaughterer', 'annihilator'] },
  { label: 'BOSSES',      color: '#ffaa22', ids: ['boss_slayer', 'boss_hunter', 'boss_bane', 'god_slayer'] },
  { label: 'DAMAGE',      color: '#ff4466', ids: ['damage_1k', 'destroyer', 'damage_50k', 'berserker', 'damage_500k', 'juggernaut'] },
  { label: 'COINS',       color: '#ffcc22', ids: ['coin_collector', 'wealthy', 'coin_250', 'coin_hoarder'] },
  { label: 'LEVELING',    color: '#44dd88', ids: ['level_3', 'quick_learner', 'ascendant', 'transcendent', 'legendary'] },
  { label: 'WEAPONS',     color: '#88aaff', ids: ['weapon_hoarder', 'arsenal', 'all_weapons', 'evolution_spear', 'evolution_axe'] },
  { label: 'WIN',         color: '#ffee44', ids: ['full_health', 'untouchable', 'glass_cannon'] },
  { label: 'MULTIPLAYER', color: '#aa66ff', ids: ['team_player', 'champions'] },
  {
    label: 'CHARACTERS', color: '#ffaa44',
    ids: [
      'char_ares_5',     'char_ares_15',
      'char_freyja_5',   'char_freyja_15',
      'char_heimdall_5', 'char_heimdall_15',
      'char_thor_5',     'char_thor_15',     'char_thor_30',
      'char_poseidon_5', 'char_poseidon_15', 'char_poseidon_30',
      'char_apollo_5',   'char_apollo_15',   'char_apollo_30',
      'char_zeus_5',     'char_zeus_15',     'char_zeus_30',
      'char_chronos_5',  'char_chronos_15',  'char_chronos_30',
      'char_odin_5',     'char_odin_15',     'char_odin_30',
      'char_hades_5',    'char_hades_15',    'char_hades_30',
    ],
  },
]

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]))
