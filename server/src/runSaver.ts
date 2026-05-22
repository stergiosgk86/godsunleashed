import { db } from './db.js'

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
}

// Validates, computes score and achievements, saves run + credits coins to profile.
// Returns the list of newly unlocked achievement IDs.
export async function saveRunRecord(data: PlayerRunData): Promise<string[]> {
  if (data.kills === 0) return []  // skip trivial runs

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

  const earned: string[] = []
  // Survival
  if (safeTime    >= 1  * 60 * 1000) earned.push('initiate')
  if (safeTime    >= 5  * 60 * 1000) earned.push('survivor_5')
  if (safeTime    >= 15 * 60 * 1000) earned.push('survivor_15')
  if (safeTime    >= 30 * 60 * 1000) earned.push('veteran')
  // Kills
  if (safeKills   >= 100)             earned.push('hunter')
  if (safeKills   >= 250)             earned.push('veteran_hunter')
  if (safeKills   >= 500)             earned.push('slaughterer')
  if (safeKills   >= 1000)            earned.push('annihilator')
  // Bosses
  if (safeBossKills >= 1)             earned.push('boss_slayer')
  if (safeBossKills >= 3)             earned.push('boss_hunter')
  // Damage
  if (safeDamage  >= 10_000)          earned.push('destroyer')
  if (safeDamage  >= 100_000)         earned.push('berserker')
  if (safeDamage  >= 1_000_000)       earned.push('juggernaut')
  // Coins
  if (safeCoins   >= 100)             earned.push('wealthy')
  if (safeCoins   >= 500)             earned.push('coin_hoarder')
  // Leveling
  if (safeLevel   >= 5)               earned.push('quick_learner')
  if (safeLevel   >= 10)              earned.push('ascendant')
  if (safeLevel   >= 20)              earned.push('transcendent')
  // Weapons
  if (safeWeapons >= 5)               earned.push('arsenal')
  if (safeWeapons >= 8)               earned.push('all_weapons')
  // Win conditions
  if (safeWon) {
    earned.push('god_slayer')
    if (safeMulti) earned.push('champions')
  }
  // Multiplayer
  if (safeMulti && (safeWon || safeKills > 0)) earned.push('team_player')

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
    db.query(
      `UPDATE profiles SET coins = LEAST(coins + $1, 5000000), active_run_token = NULL, updated_at = NOW()
       WHERE user_id = $2`,
      [safeCoins, data.userId],
    ),
    Promise.all(achievementInserts),
  ])

  return achievementResults.flatMap(r => r.rows).map(r => r.achievement_id as string)
}
