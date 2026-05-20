import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'

export const apiRouter = Router()
apiRouter.use(requireAuth)

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_PROFILE_COINS  = 5_000_000
const MAX_RUN_SCORE      = 10_000_000
const MAX_RUN_KILLS      = 10_000
const MAX_RUN_TIME_MS    = 32 * 60 * 1000
const MAX_SESSION_COINS  = 300    // ~3× observed best; real max is ~0.1 coins/sec
const MAX_COINS_PER_SEC  = 0.5   // generous ceiling — 5× observed max rate
const MIN_RUN_GAP_MS     = 10_000 // minimum 10 s between submissions
const RUN_DURATION_MS    = 30 * 60 * 1000  // must match client runData.ts
const MAX_KILLS_PER_SEC  = 50    // generous ceiling for burst AoE builds
const MAX_XP_PER_SEC     = 500   // MAX_KILLS_PER_SEC × max xp/kill (5) × max xp scale (2)
const BOSS_FIRST_MS      = 90_000
const BOSS_REPEAT_MS     = 120_000

// In-memory rate limit per user — resets on server restart which is acceptable
const lastRunAt = new Map<number, number>()

// Must match client UPGRADE_COSTS / UPGRADE_MAX_RANK
const UPGRADE_COSTS = [50, 125, 250, 450, 750]
const MAX_UPGRADE_RANK = 5
const VALID_UPGRADE_KEYS = new Set(['maxHealth', 'recovery', 'magnet', 'might', 'luck', 'growth', 'moveSpeed', 'armor', 'attackSpeed'])

// Characters that require coins to unlock (others are free)
const CHARACTER_UNLOCK_COSTS: Record<string, number> = { witch: 150, shade: 300, zeus: 1000 }
const LOCKABLE_CHARACTERS = new Set(Object.keys(CHARACTER_UNLOCK_COSTS))

const VALID_ACHIEVEMENT_IDS = new Set([
  'survivor_5', 'veteran', 'boss_slayer', 'hunter', 'slaughterer',
  'destroyer', 'wealthy', 'ascendant', 'transcendent', 'arsenal',
  'god_slayer', 'untouchable', 'glass_cannon', 'champions', 'team_player',
])

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }
function isFiniteNumber(v: unknown): v is number { return typeof v === 'number' && isFinite(v) }

// Must mirror gameStore.ts xpNeeded — total XP required to reach `level` from level 1
function xpToReachLevel(level: number): number {
  let total = 0
  for (let i = 1; i < level; i++) total += Math.floor(i * (i + 4) * 2)
  return total
}

// ── Profile ───────────────────────────────────────────────────────────────────

apiRouter.get('/profile', async (req: Request, res: Response) => {
  const result = await db.query(
    `SELECT p.coins, p.upgrades, p.key_bindings, p.unlocked_characters, u.role
     FROM profiles p JOIN users u ON u.id = p.user_id
     WHERE p.user_id = $1`,
    [req.userId],
  )
  const row = result.rows[0]
  if (!row) { res.status(404).json({ error: 'Profile not found' }); return }

  // Sanitize upgrades: clamp every rank to [0, MAX_UPGRADE_RANK] regardless of DB contents
  const rawUpgrades = (row.upgrades ?? {}) as Record<string, unknown>
  const sanitizedUpgrades: Record<string, number> = {}
  for (const key of VALID_UPGRADE_KEYS) {
    const rank = Number(rawUpgrades[key] ?? 0)
    sanitizedUpgrades[key] = Math.max(0, Math.min(MAX_UPGRADE_RANK, isFinite(rank) ? Math.floor(rank) : 0))
  }

  // Sanitize unlocked_characters: only keep known lockable character IDs
  const rawUnlocked = Array.isArray(row.unlocked_characters) ? row.unlocked_characters : []
  const unlockedCharacters = rawUnlocked.filter((id: unknown) => typeof id === 'string' && LOCKABLE_CHARACTERS.has(id))

  res.json({ ...row, upgrades: sanitizedUpgrades, unlocked_characters: unlockedCharacters })
})

// ── Character unlocks ─────────────────────────────────────────────────────────

apiRouter.post('/characters/unlock', async (req: Request, res: Response) => {
  const { character } = req.body ?? {}
  if (typeof character !== 'string' || !LOCKABLE_CHARACTERS.has(character)) {
    res.status(400).json({ error: 'Invalid character' }); return
  }

  const cost = CHARACTER_UNLOCK_COSTS[character]
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const profileRes = await client.query(
      'SELECT coins, unlocked_characters FROM profiles WHERE user_id = $1 FOR UPDATE',
      [req.userId],
    )
    if (!profileRes.rows[0]) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Profile not found' }); return }

    const { coins, unlocked_characters } = profileRes.rows[0] as { coins: number; unlocked_characters: string[] }
    const alreadyUnlocked = Array.isArray(unlocked_characters) && unlocked_characters.includes(character)

    if (alreadyUnlocked) {
      await client.query('ROLLBACK'); res.status(400).json({ error: 'Already unlocked' }); return
    }
    if (coins < cost) {
      await client.query('ROLLBACK'); res.status(400).json({ error: 'Not enough coins' }); return
    }

    const newUnlocked = [...(Array.isArray(unlocked_characters) ? unlocked_characters : []), character]
    await client.query(
      'UPDATE profiles SET coins = coins - $1, unlocked_characters = $2, updated_at = NOW() WHERE user_id = $3',
      [cost, newUnlocked, req.userId],
    )
    await client.query('COMMIT')
    res.json({ ok: true, coins: coins - cost, unlocked_characters: newUnlocked })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Character unlock error:', err)
    res.status(500).json({ error: 'Internal server error' })
  } finally {
    client.release()
  }
})

// ── Key bindings ──────────────────────────────────────────────────────────────

const VALID_BINDING_ACTIONS = new Set(['up', 'down', 'left', 'right', 'dash'])

apiRouter.post('/key-bindings', async (req: Request, res: Response) => {
  const { bindings } = req.body ?? {}
  if (typeof bindings !== 'object' || bindings === null || Array.isArray(bindings)) {
    res.status(400).json({ error: 'Invalid bindings' }); return
  }
  const sanitized: Record<string, number> = {}
  for (const [action, keyCode] of Object.entries(bindings as Record<string, unknown>)) {
    if (!VALID_BINDING_ACTIONS.has(action) || !isFiniteNumber(keyCode as number)) {
      res.status(400).json({ error: `Invalid binding: ${action}` }); return
    }
    const code = Math.floor(keyCode as number)
    if (code < 1 || code > 255) { res.status(400).json({ error: `Keycode out of range: ${code}` }); return }
    sanitized[action] = code
  }
  await db.query(
    'UPDATE profiles SET key_bindings = $1::jsonb, updated_at = NOW() WHERE user_id = $2',
    [JSON.stringify(sanitized), req.userId],
  )
  res.json({ ok: true })
})

// ── Upgrade purchases (server-side, atomic) ───────────────────────────────────

apiRouter.post('/upgrades/purchase', async (req: Request, res: Response) => {
  const { upgrade } = req.body ?? {}
  if (typeof upgrade !== 'string' || !VALID_UPGRADE_KEYS.has(upgrade)) {
    res.status(400).json({ error: 'Invalid upgrade' }); return
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const profileRes = await client.query(
      'SELECT coins, upgrades FROM profiles WHERE user_id = $1 FOR UPDATE',
      [req.userId],
    )
    if (!profileRes.rows[0]) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Profile not found' }); return }

    const { coins, upgrades } = profileRes.rows[0] as { coins: number; upgrades: Record<string, number> }
    const rank = upgrades[upgrade] ?? 0

    if (rank >= MAX_UPGRADE_RANK) {
      await client.query('ROLLBACK'); res.status(400).json({ error: 'Already maxed' }); return
    }
    const cost = UPGRADE_COSTS[rank]
    if (coins < cost) {
      await client.query('ROLLBACK'); res.status(400).json({ error: 'Not enough coins' }); return
    }

    const newUpgrades = { ...upgrades, [upgrade]: rank + 1 }
    await client.query(
      'UPDATE profiles SET coins = coins - $1, upgrades = $2::jsonb, updated_at = NOW() WHERE user_id = $3',
      [cost, JSON.stringify(newUpgrades), req.userId],
    )
    await client.query('COMMIT')
    res.json({ ok: true, coins: coins - cost, upgrades: newUpgrades })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Purchase error:', err)
    res.status(500).json({ error: 'Internal server error' })
  } finally {
    client.release()
  }
})

// ── Upgrade refunds (lose one rank, get coins back) ───────────────────────────

apiRouter.post('/upgrades/refund', async (req: Request, res: Response) => {
  const { upgrade } = req.body ?? {}
  if (typeof upgrade !== 'string' || !VALID_UPGRADE_KEYS.has(upgrade)) {
    res.status(400).json({ error: 'Invalid upgrade' }); return
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const profileRes = await client.query(
      'SELECT coins, upgrades FROM profiles WHERE user_id = $1 FOR UPDATE',
      [req.userId],
    )
    if (!profileRes.rows[0]) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Profile not found' }); return }

    const { coins, upgrades } = profileRes.rows[0] as { coins: number; upgrades: Record<string, number> }
    const rank = upgrades[upgrade] ?? 0

    if (rank <= 0) {
      await client.query('ROLLBACK'); res.status(400).json({ error: 'Nothing to refund' }); return
    }

    const refund = UPGRADE_COSTS[rank - 1]
    const newUpgrades = { ...upgrades, [upgrade]: rank - 1 }
    const newCoins = Math.min(MAX_PROFILE_COINS, coins + refund)
    await client.query(
      'UPDATE profiles SET coins = $1, upgrades = $2::jsonb, updated_at = NOW() WHERE user_id = $3',
      [newCoins, JSON.stringify(newUpgrades), req.userId],
    )
    await client.query('COMMIT')
    res.json({ ok: true, coins: newCoins, upgrades: newUpgrades })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Refund error:', err)
    res.status(500).json({ error: 'Internal server error' })
  } finally {
    client.release()
  }
})

// ── Refund all upgrades ───────────────────────────────────────────────────────

apiRouter.post('/upgrades/refund-all', async (req: Request, res: Response) => {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const profileRes = await client.query(
      'SELECT coins, upgrades FROM profiles WHERE user_id = $1 FOR UPDATE',
      [req.userId],
    )
    if (!profileRes.rows[0]) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Profile not found' }); return }

    const { coins, upgrades } = profileRes.rows[0] as { coins: number; upgrades: Record<string, number> }

    let refund = 0
    for (const rank of Object.values(upgrades)) {
      for (let r = 0; r < Math.min(rank, UPGRADE_COSTS.length); r++) refund += UPGRADE_COSTS[r]
    }

    if (refund === 0) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Nothing to refund' }); return }

    const emptyUpgrades: Record<string, number> = {}
    for (const key of Object.keys(upgrades)) emptyUpgrades[key] = 0

    const newCoins = Math.min(MAX_PROFILE_COINS, coins + refund)
    await client.query(
      'UPDATE profiles SET coins = $1, upgrades = $2::jsonb, updated_at = NOW() WHERE user_id = $3',
      [newCoins, JSON.stringify(emptyUpgrades), req.userId],
    )
    await client.query('COMMIT')
    res.json({ ok: true, coins: newCoins, upgrades: emptyUpgrades })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Refund-all error:', err)
    res.status(500).json({ error: 'Internal server error' })
  } finally {
    client.release()
  }
})

// ── Admin ─────────────────────────────────────────────────────────────────────

apiRouter.get('/admin/players', async (req: Request, res: Response) => {
  try {
    const userRes = await db.query('SELECT role FROM users WHERE id = $1', [req.userId])
    if (userRes.rows[0]?.role !== 'super_admin') {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    const result = await db.query(
      `SELECT u.id, u.username, u.created_at,
              p.coins, p.upgrades, p.updated_at AS last_active
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       ORDER BY u.id`,
    )
    res.json({ players: result.rows })
  } catch (err) {
    console.error('Admin players error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

apiRouter.post('/admin/players/:id/reset', async (req: Request, res: Response) => {
  try {
    const userRes = await db.query('SELECT role FROM users WHERE id = $1', [req.userId])
    if (userRes.rows[0]?.role !== 'super_admin') {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    const targetId = parseInt(req.params.id, 10)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      res.status(400).json({ error: 'Invalid user id' }); return
    }
    const emptyUpgrades: Record<string, number> = {}
    for (const key of VALID_UPGRADE_KEYS) emptyUpgrades[key] = 0
    await db.query(
      'UPDATE profiles SET coins = 0, upgrades = $1::jsonb, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify(emptyUpgrades), targetId],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('Admin reset error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Leaderboard ───────────────────────────────────────────────────────────────

apiRouter.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const [top, personal] = await Promise.all([
      db.query(
        `SELECT id, username, score, kills, time_survived, coins, won, multiplayer
         FROM runs ORDER BY score DESC LIMIT 20`,
      ),
      db.query(
        `SELECT id FROM runs WHERE user_id = $1 ORDER BY score DESC LIMIT 1`,
        [req.userId],
      ),
    ])
    res.json({ runs: top.rows, personalBestId: personal.rows[0]?.id ?? null })
  } catch (err) {
    console.error('Leaderboard error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Issues a single-use token that must be included with the run submission.
// Prevents submitting runs without having actually started a game session.
apiRouter.post('/runs/start', async (req: Request, res: Response) => {
  const token = randomUUID()
  await db.query(
    'UPDATE profiles SET active_run_token = $1 WHERE user_id = $2',
    [token, req.userId],
  )
  res.json({ token })
})

apiRouter.post('/runs', async (req: Request, res: Response) => {
  const {
    runToken, score, kills, timeSurvived, coins, won, multiplayer,
    bossKills, level, damageDealt, weaponCount, tookDamage, finalHp, maxHp,
  } = req.body ?? {}

  if (!isFiniteNumber(score) || score < 0) {
    res.status(400).json({ error: 'Invalid score' }); return
  }

  // Verify the run was legitimately started via /runs/start
  const profileRow = await db.query(
    'SELECT active_run_token FROM profiles WHERE user_id = $1',
    [req.userId],
  )
  if (!runToken || profileRow.rows[0]?.active_run_token !== runToken) {
    res.status(403).json({ error: 'Invalid run token' }); return
  }

  const safeKills   = clamp(Math.floor(kills    ?? 0),     0, MAX_RUN_KILLS)
  const safeTime    = clamp(Math.round(timeSurvived ?? 0), 0, MAX_RUN_TIME_MS)
  const safeWon     = won === true
  const safeMulti   = multiplayer === true

  // Rate limit: submissions must be spaced at least as long as the claimed run
  const now = Date.now()
  const last = lastRunAt.get(req.userId) ?? 0
  const requiredGap = Math.max(MIN_RUN_GAP_MS, safeTime)
  if (now - last < requiredGap) {
    res.status(429).json({ error: 'Too soon' }); return
  }
  lastRunAt.set(req.userId, now)

  // Coins cannot exceed what's physically earnable in the claimed time
  const maxEarnableCoins = Math.ceil(safeTime / 1000 * MAX_COINS_PER_SEC)
  const safeCoins = clamp(Math.floor(coins ?? 0), 0, Math.min(MAX_SESSION_COINS, maxEarnableCoins))

  // Kill rate: physically impossible to kill faster than MAX_KILLS_PER_SEC
  const maxEarnableKills = Math.ceil(safeTime / 1000 * MAX_KILLS_PER_SEC)
  if (safeKills > maxEarnableKills) {
    res.status(400).json({ error: 'Invalid kills' }); return
  }

  // Won requires surviving the full run duration (allow 5 s timing grace)
  if (safeWon && safeTime < RUN_DURATION_MS - 5_000) {
    res.status(400).json({ error: 'Invalid win claim' }); return
  }

  // Boss kills are bounded by the spawn schedule
  const safeBossKillsCap = safeTime >= BOSS_FIRST_MS
    ? Math.floor((safeTime - BOSS_FIRST_MS) / BOSS_REPEAT_MS) + 2 // +1 regular cycle + 1 final boss
    : 0
  const safeBossKills = clamp(Math.floor(bossKills ?? 0), 0, safeBossKillsCap)

  // Recompute score server-side — ignore whatever the client submitted
  const safeScore = clamp(
    safeKills * 10 + safeCoins * 5 + Math.floor(safeTime / 1000) * 2 + (safeWon ? 5000 : 0),
    0, MAX_RUN_SCORE,
  )

  // Compute achievements server-side from the submitted run data
  const maxEarnableXp   = Math.ceil(safeTime / 1000 * MAX_XP_PER_SEC)
  const rawLevel        = clamp(Math.floor(level ?? 1), 1, 100)
  // Walk down until the XP required to reach this level fits within the run time
  let safeLevel = rawLevel
  while (safeLevel > 1 && xpToReachLevel(safeLevel) > maxEarnableXp) safeLevel--
  const safeDamage      = clamp(Math.floor(damageDealt ?? 0), 0, 1_000_000_000)
  const safeWeapons     = clamp(Math.floor(weaponCount ?? 1), 1, 10)
  const safeTookDamage  = tookDamage !== false
  const safeFinalHp     = clamp(Math.floor(finalHp ?? 0), 0, 100_000)
  const safeMaxHp       = clamp(Math.floor(maxHp   ?? 1), 1, 100_000)

  const earned: string[] = []
  if (safeTime    >= 5  * 60 * 1000) earned.push('survivor_5')
  if (safeTime    >= 30 * 60 * 1000) earned.push('veteran')
  if (safeBossKills >= 1)            earned.push('boss_slayer')
  if (safeKills   >= 100)            earned.push('hunter')
  if (safeKills   >= 500)            earned.push('slaughterer')
  if (safeDamage  >= 10_000)         earned.push('destroyer')
  if (safeCoins   >= 100)            earned.push('wealthy')
  if (safeLevel   >= 10)             earned.push('ascendant')
  if (safeLevel   >= 20)             earned.push('transcendent')
  if (safeWeapons >= 5)              earned.push('arsenal')
  if (safeWon) {
    earned.push('god_slayer')
    if (!safeTookDamage)                                  earned.push('untouchable')
    if (safeFinalHp <= Math.ceil(safeMaxHp * 0.1))        earned.push('glass_cannon')
    if (safeMulti)                                        earned.push('champions')
  }
  if (safeMulti && (safeWon || safeKills > 0))            earned.push('team_player')

  const user = await db.query('SELECT username FROM users WHERE id = $1', [req.userId])

  // All writes in parallel: save run, credit coins, clear token, unlock achievements
  const achievementInserts = earned.map(id =>
    db.query(
      `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING achievement_id`,
      [req.userId, id],
    )
  )

  const [, , achievementResults] = await Promise.all([
    db.query(
      `INSERT INTO runs (user_id, username, score, kills, time_survived, coins, won, multiplayer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.userId, user.rows[0].username, safeScore, safeKills, safeTime, safeCoins, safeWon, safeMulti],
    ),
    db.query(
      `UPDATE profiles SET coins = LEAST(coins + $1, $2), active_run_token = NULL, updated_at = NOW() WHERE user_id = $3`,
      [safeCoins, MAX_PROFILE_COINS, req.userId],
    ),
    Promise.all(achievementInserts),
  ])

  const newlyUnlocked = achievementResults
    .flatMap(r => r.rows)
    .map(r => r.achievement_id as string)

  res.json({ ok: true, newAchievements: newlyUnlocked })
})

// ── Achievements ──────────────────────────────────────────────────────────────

apiRouter.get('/achievements', async (req: Request, res: Response) => {
  const result = await db.query(
    `SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1`,
    [req.userId],
  )
  res.json({ achievements: result.rows })
})

// Achievements are now computed server-side inside POST /runs.
// Return 410 Gone so old clients fail loudly instead of silently.
apiRouter.post('/achievements/unlock', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Gone' })
})
