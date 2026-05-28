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
  { id: 'weapon_hoarder', name: 'Armed',           description: 'Have 3 or more weapons active',           icon: '⊙' },
  { id: 'arsenal',        name: 'Arsenal',         description: 'Have 5 or more weapons active',           icon: '⊕' },
  { id: 'all_weapons',    name: 'Omniarmed',       description: 'Have all 8 weapons active simultaneously', icon: '⬢' },
  // Win conditions
  { id: 'full_health',    name: 'Unscathed',       description: 'Win a run with full HP remaining',        icon: '◍' },
  { id: 'untouchable',    name: 'Untouchable',     description: 'Win a full run without taking damage',    icon: '○' },
  { id: 'glass_cannon',   name: 'Glass Cannon',    description: 'Win a run with 10% HP or less',           icon: '◇' },
  // Multiplayer
  { id: 'team_player',    name: 'Team Player',     description: 'Complete a multiplayer game',             icon: '◉' },
  { id: 'champions',      name: 'Champions',       description: 'Win a multiplayer run',                   icon: '★' },
]

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  { label: 'SURVIVAL',    color: '#44aaff', ids: ['initiate', 'survivor_3', 'survivor_5', 'survivor_10', 'survivor_15', 'veteran'] },
  { label: 'KILLS',       color: '#ff6644', ids: ['first_blood', 'bloodthirsty', 'hunter', 'veteran_hunter', 'slaughterer', 'annihilator'] },
  { label: 'BOSSES',      color: '#ffaa22', ids: ['boss_slayer', 'boss_hunter', 'boss_bane', 'god_slayer'] },
  { label: 'DAMAGE',      color: '#ff4466', ids: ['damage_1k', 'destroyer', 'damage_50k', 'berserker', 'damage_500k', 'juggernaut'] },
  { label: 'COINS',       color: '#ffcc22', ids: ['coin_collector', 'wealthy', 'coin_250', 'coin_hoarder'] },
  { label: 'LEVELING',    color: '#44dd88', ids: ['level_3', 'quick_learner', 'ascendant', 'transcendent', 'legendary'] },
  { label: 'WEAPONS',     color: '#88aaff', ids: ['weapon_hoarder', 'arsenal', 'all_weapons'] },
  { label: 'WIN',         color: '#ffee44', ids: ['full_health', 'untouchable', 'glass_cannon'] },
  { label: 'MULTIPLAYER', color: '#aa66ff', ids: ['team_player', 'champions'] },
]

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]))
