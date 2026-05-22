export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
}

export const ACHIEVEMENTS: Achievement[] = [
  // Survival
  { id: 'initiate',      name: 'Initiate',      description: 'Survive for 1 minute',                   icon: '▸' },
  { id: 'survivor_5',    name: 'Survivor',      description: 'Survive for 5 minutes',                  icon: '▶' },
  { id: 'survivor_15',   name: 'Enduring',      description: 'Survive for 15 minutes',                 icon: '◐' },
  { id: 'veteran',       name: 'Veteran',       description: 'Survive for 30 minutes (full run)',       icon: '◈' },
  // Kills
  { id: 'hunter',        name: 'Hunter',        description: 'Kill 100 enemies in one run',             icon: '►' },
  { id: 'veteran_hunter',name: 'Relentless',    description: 'Kill 250 enemies in one run',             icon: '◁' },
  { id: 'slaughterer',   name: 'Slaughterer',   description: 'Kill 500 enemies in one run',             icon: '◆' },
  { id: 'annihilator',   name: 'Annihilator',   description: 'Kill 1,000 enemies in one run',           icon: '❖' },
  // Bosses
  { id: 'boss_slayer',   name: 'Boss Slayer',   description: 'Defeat your first boss',                  icon: '⚔' },
  { id: 'boss_hunter',   name: 'Boss Hunter',   description: 'Defeat 3 bosses in one run',              icon: '◬' },
  { id: 'god_slayer',    name: 'God Slayer',    description: 'Defeat the final boss and win',            icon: '☠' },
  // Damage
  { id: 'destroyer',     name: 'Destroyer',     description: 'Deal 10,000 damage in one run',           icon: '✦' },
  { id: 'berserker',     name: 'Berserker',     description: 'Deal 100,000 damage in one run',          icon: '✸' },
  { id: 'juggernaut',    name: 'Juggernaut',    description: 'Deal 1,000,000 damage in one run',        icon: '⬟' },
  // Coins
  { id: 'wealthy',       name: 'Wealthy',       description: 'Collect 100 coins in one run',            icon: '◎' },
  { id: 'coin_hoarder',  name: 'Coin Hoarder',  description: 'Collect 500 coins in one run',            icon: '⬡' },
  // Leveling
  { id: 'quick_learner', name: 'Quick Learner', description: 'Reach level 5 in one run',                icon: '▴' },
  { id: 'ascendant',     name: 'Ascendant',     description: 'Reach level 10 in one run',               icon: '▲' },
  { id: 'transcendent',  name: 'Transcendent',  description: 'Reach level 20 in one run',               icon: '△' },
  // Weapons & Build
  { id: 'arsenal',       name: 'Arsenal',       description: 'Have 5 or more weapons active',           icon: '◈' },
  { id: 'all_weapons',   name: 'Omniarmed',     description: 'Have all 8 weapons active simultaneously', icon: '⬢' },
  // Win conditions
  { id: 'full_health',   name: 'Unscathed',     description: 'Win a run with full HP remaining',        icon: '◍' },
  { id: 'untouchable',   name: 'Untouchable',   description: 'Win a full run without taking damage',    icon: '○' },
  { id: 'glass_cannon',  name: 'Glass Cannon',  description: 'Win a run with 10% HP or less',           icon: '◇' },
  // Multiplayer
  { id: 'team_player',   name: 'Team Player',   description: 'Complete a multiplayer game',             icon: '◉' },
  { id: 'champions',     name: 'Champions',     description: 'Win a multiplayer run',                   icon: '★' },
]

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]))
