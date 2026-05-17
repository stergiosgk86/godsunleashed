export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'survivor_5',   name: 'Survivor',     description: 'Survive for 5 minutes',                icon: '▶' },
  { id: 'veteran',      name: 'Veteran',      description: 'Survive for 30 minutes (full run)',     icon: '◈' },
  { id: 'boss_slayer',  name: 'Boss Slayer',  description: 'Defeat your first boss',                icon: '⚔' },
  { id: 'god_slayer',   name: 'God Slayer',   description: 'Defeat the final boss and win',         icon: '☠' },
  { id: 'hunter',       name: 'Hunter',       description: 'Kill 100 enemies in one run',           icon: '►' },
  { id: 'slaughterer',  name: 'Slaughterer',  description: 'Kill 500 enemies in one run',           icon: '◆' },
  { id: 'destroyer',    name: 'Destroyer',    description: 'Deal 10,000 damage in one run',         icon: '✦' },
  { id: 'wealthy',      name: 'Wealthy',      description: 'Collect 100 coins in one run',          icon: '◎' },
  { id: 'ascendant',    name: 'Ascendant',    description: 'Reach level 10 in one run',             icon: '▲' },
  { id: 'transcendent', name: 'Transcendent', description: 'Reach level 20 in one run',             icon: '△' },
  { id: 'arsenal',      name: 'Arsenal',      description: 'Have 5 or more weapons active',         icon: '◈' },
  { id: 'untouchable',  name: 'Untouchable',  description: 'Win a full run without taking damage',  icon: '○' },
  { id: 'team_player',  name: 'Team Player',  description: 'Complete a multiplayer game',           icon: '◉' },
  { id: 'champions',    name: 'Champions',    description: 'Win a multiplayer run',                 icon: '★' },
  { id: 'glass_cannon', name: 'Glass Cannon', description: 'Win a run with 10% HP or less',         icon: '◇' },
]

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]))
