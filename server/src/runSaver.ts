import { db } from './db.js'
import { notifySuperAdmins } from './userSockets.js'

const MAX_RUN_SCORE    = 100_000
const MAX_RUN_KILLS    = 7_000
const MAX_SESSION_COINS = 300
const BOSS_FIRST_MS    = 90_000
const BOSS_REPEAT_MS   = 120_000

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }

export interface PlayerRunData {
  userId: number
  username: string
  kills: number
  coins: number
  timeSurvived: number  // ms
  won: boolean
  bossKills: number
  level: number
  weaponCount: number
  multiplayer: boolean
  damageDealt: number
  stage: number
  characterType?: string
  // Evolution readiness flags — set by GameRoom when all in-run prerequisites are met
  spearEvolutionReady?: boolean  // spear + spearCount>=5 + spearSpeed>=3
  axeEvolutionReady?: boolean    // axe + axeAmount>=1 + axeDamage>=1 + axePierce>=1
}

// Keys for weapon groups that can be unlocked. Each key gates the entire group in the level-up pool.
// 'melee' and 'wand' are always available and not listed here.
// Evolution keys ('spearStorm', 'axeEvolution') gate only the evolution upgrade within their group.
export const ALL_WEAPON_UNLOCK_KEYS = [
  'orbital', 'boomerang', 'flameTrail', 'bloodNova', 'lightning',
  'axe', 'aura', 'equinox', 'ravens', 'spear',
  'vampiric', 'divineShield', 'echo',
  'spearStorm', 'axeEvolution',
] as const
export type WeaponUnlockKey = typeof ALL_WEAPON_UNLOCK_KEYS[number]

function computeNewWeaponUnlocks(data: PlayerRunData, already: Set<string>): string[] {
  const t = data.timeSurvived
  const char = data.characterType ?? ''
  const earned: string[] = []
  const add = (key: string) => { if (!already.has(key)) earned.push(key) }

  // Any-character milestones
  if (t >= 10 * 60_000) add('divineShield')
  if (t >= 15 * 60_000) { add('aura'); add('flameTrail') }
  if (t >= 25 * 60_000) add('bloodNova')
  if (data.level >= 60)      add('axe')
  if (data.kills >= 500)     add('vampiric')
  if (data.weaponCount >= 4) add('echo')

  // Character-specific survival
  if (char === 'freyja'   && t >= 12 * 60_000) add('boomerang')
  if (char === 'zeus'     && t >= 12 * 60_000) add('lightning')
  if (char === 'poseidon' && t >= 12 * 60_000) add('orbital')
  if (char === 'heimdall' && t >= 12 * 60_000) add('spear')
  if (char === 'chronos'  && t >= 15 * 60_000) add('equinox')
  if (char === 'odin'     && t >= 15 * 60_000) add('ravens')

  // Weapon evolutions — unlocked when in-run prerequisites are fully met in any run
  if (data.spearEvolutionReady) add('spearStorm')
  if (data.axeEvolutionReady)   add('axeEvolution')

  return earned
}

const CHAR_30_MIN_SET = new Set(['poseidon', 'apollo', 'zeus', 'chronos', 'odin', 'hades', 'thor'])

// Validates, computes score and achievements, saves run + credits coins to profile.
// Returns newly unlocked achievement IDs and weapon group keys.
export async function saveRunRecord(data: PlayerRunData): Promise<{ achievements: string[]; weapons: string[] }> {
  if (data.kills === 0) return { achievements: [], weapons: [] }  // skip trivial runs

  const safeKills    = clamp(data.kills,        0, MAX_RUN_KILLS)
  const safeCoins    = clamp(data.coins,         0, MAX_SESSION_COINS)
  const safeTime     = clamp(Math.round(data.timeSurvived), 0, 32 * 60 * 1000)
  const safeWon      = data.won
  const safeMulti    = data.multiplayer
  const bossCapRaw   = safeTime >= BOSS_FIRST_MS
    ? Math.floor((safeTime - BOSS_FIRST_MS) / BOSS_REPEAT_MS) + 2
    : 0
  const safeBossKills  = clamp(data.bossKills,   0, bossCapRaw)
  const safeDamage     = clamp(data.damageDealt,  0, 1_000_000_000)
  const safeLevel      = clamp(data.level,        1, 100)
  const safeWeapons    = clamp(data.weaponCount,  1, 10)

  const safeScore = clamp(
    safeKills * 10 + safeCoins * 5 + Math.floor(safeTime / 1000) * 2 + (safeWon ? 5000 : 0),
    0, MAX_RUN_SCORE,
  )

  // Fetch current unlocked weapons before the run's DB writes
  const weaponRow = await db.query(
    'SELECT unlocked_weapons FROM profiles WHERE user_id = $1',
    [data.userId],
  )
  const currentWeapons = new Set<string>(weaponRow.rows[0]?.unlocked_weapons ?? [])
  const newWeapons = computeNewWeaponUnlocks(data, currentWeapons)

  const earned: string[] = []
  // Survival
  if (safeTime      >= 1  * 60 * 1000) earned.push('initiate')
  if (safeTime      >= 3  * 60 * 1000) earned.push('survivor_3')
  if (safeTime      >= 5  * 60 * 1000) earned.push('survivor_5')
  if (safeTime      >= 10 * 60 * 1000) earned.push('survivor_10')
  if (safeTime      >= 15 * 60 * 1000) earned.push('survivor_15')
  if (safeTime      >= 30 * 60 * 1000) earned.push('veteran')
  // Kills
  if (safeKills     >= 1)              earned.push('first_blood')
  if (safeKills     >= 50)             earned.push('bloodthirsty')
  if (safeKills     >= 100)            earned.push('hunter')
  if (safeKills     >= 250)            earned.push('veteran_hunter')
  if (safeKills     >= 500)            earned.push('slaughterer')
  if (safeKills     >= 1000)           earned.push('annihilator')
  // Bosses
  if (safeBossKills >= 1)              earned.push('boss_slayer')
  if (safeBossKills >= 3)              earned.push('boss_hunter')
  if (safeBossKills >= 5)              earned.push('boss_bane')
  // Damage
  if (safeDamage    >= 1_000)          earned.push('damage_1k')
  if (safeDamage    >= 10_000)         earned.push('destroyer')
  if (safeDamage    >= 50_000)         earned.push('damage_50k')
  if (safeDamage    >= 100_000)        earned.push('berserker')
  if (safeDamage    >= 500_000)        earned.push('damage_500k')
  if (safeDamage    >= 1_000_000)      earned.push('juggernaut')
  // Coins
  if (safeCoins     >= 50)             earned.push('coin_collector')
  if (safeCoins     >= 100)            earned.push('wealthy')
  if (safeCoins     >= 250)            earned.push('coin_250')
  if (safeCoins     >= 500)            earned.push('coin_hoarder')
  // Leveling
  if (safeLevel     >= 3)              earned.push('level_3')
  if (safeLevel     >= 5)              earned.push('quick_learner')
  if (safeLevel     >= 10)             earned.push('ascendant')
  if (safeLevel     >= 20)             earned.push('transcendent')
  if (safeLevel     >= 30)             earned.push('legendary')
  // Weapons
  if (safeWeapons   >= 3)              earned.push('weapon_hoarder')
  if (safeWeapons   >= 5)              earned.push('arsenal')
  if (safeWeapons   >= 8)              earned.push('all_weapons')
  // Evolutions — fires exactly once, the run the player first meets all prerequisites
  if (newWeapons.includes('spearStorm'))   earned.push('evolution_spear')
  if (newWeapons.includes('axeEvolution')) earned.push('evolution_axe')
  // Win conditions
  if (safeWon) {
    earned.push('god_slayer')
    if (safeMulti) earned.push('champions')
  }
  // Multiplayer
  if (safeMulti && (safeWon || safeKills > 0)) earned.push('team_player')
  // Character survival
  const char = data.characterType ?? ''
  if (char && safeTime >= 5  * 60 * 1000) earned.push(`char_${char}_5`)
  if (char && safeTime >= 15 * 60 * 1000) earned.push(`char_${char}_15`)
  if (char && CHAR_30_MIN_SET.has(char) && safeTime >= 30 * 60 * 1000) earned.push(`char_${char}_30`)

  const achievementInserts = earned.map(id =>
    db.query(
      `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING achievement_id`,
      [data.userId, id],
    )
  )

  const [, , achievementResults] = await Promise.all([
    db.query(
      `INSERT INTO runs (user_id, username, score, kills, time_survived, coins, won, multiplayer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [data.userId, data.username, safeScore, safeKills, safeTime, safeCoins, safeWon, safeMulti],
    ),
    data.stage === 1
      ? db.query(
          `UPDATE profiles SET coins = LEAST(coins + $1, 5000000), active_run_token = NULL,
           max_stage1_level = GREATEST(max_stage1_level, $2),
           unlocked_weapons = ARRAY(SELECT DISTINCT unnest(unlocked_weapons || $3::text[])),
           updated_at = NOW() WHERE user_id = $4`,
          [safeCoins, safeLevel, newWeapons, data.userId],
        )
      : db.query(
          `UPDATE profiles SET coins = LEAST(coins + $1, 5000000), active_run_token = NULL,
           unlocked_weapons = ARRAY(SELECT DISTINCT unnest(unlocked_weapons || $2::text[])),
           updated_at = NOW() WHERE user_id = $3`,
          [safeCoins, newWeapons, data.userId],
        ),
    Promise.all(achievementInserts),
  ])

  // Push live profile update to any watching super_admins
  db.query(
    `SELECT u.role, p.coins, p.upgrades, p.updated_at AS last_active, p.unlocked_stages
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1`,
    [data.userId],
  ).then(r => {
    if (r.rows[0]) notifySuperAdmins(JSON.stringify({ type: 'playerProfileUpdate', userId: data.userId, ...r.rows[0] }))
  }).catch(() => {})

  return {
    achievements: achievementResults.flatMap(r => r.rows).map(r => r.achievement_id as string),
    weapons: newWeapons,
  }
}
