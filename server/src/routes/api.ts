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

// In-memory rate limit per user — resets on server restart which is acceptable
const lastRunAt = new Map<number, number>()

// Must match client UPGRADE_COSTS / UPGRADE_MAX_RANK
const UPGRADE_COSTS = [10, 25, 50, 90, 150]
const MAX_UPGRADE_RANK = 5
const VALID_UPGRADE_KEYS = new Set(['maxHealth', 'recovery', 'magnet', 'might', 'luck', 'growth', 'moveSpeed', 'armor'])

const VALID_ACHIEVEMENT_IDS = new Set([
  'survivor_5', 'veteran', 'boss_slayer', 'hunter', 'slaughterer',
  'destroyer', 'wealthy', 'ascendant', 'transcendent', 'arsenal',
  'god_slayer', 'untouchable', 'glass_cannon', 'champions', 'team_player',
])

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }
function isFiniteNumber(v: unknown): v is number { return typeof v === 'number' && isFinite(v) }

// ── Profile ───────────────────────────────────────────────────────────────────

apiRouter.get('/profile', async (req: Request, res: Response) => {
  const result = await db.query(
    `SELECT p.coins, p.upgrades, p.key_bindings, u.role
     FROM profiles p JOIN users u ON u.id = p.user_id
     WHERE p.user_id = $1`,
    [req.userId],
  )
  const row = result.rows[0]
  if (!row) { res.status(404).json({ error: 'Profile not found' }); return }
  res.json(row)
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

// ── Admin ─────────────────────────────────────────────────────────────────────

apiRouter.get('/admin/players', async (req: Request, res: Response) => {
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
})

// ── Leaderboard ───────────────────────────────────────────────────────────────

apiRouter.get('/leaderboard', async (req: Request, res: Response) => {
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
})

// Issues a single-use token that must be included with the run submission.
// Prevents submitting runs without having actually started a game session.
apiRouter.post('/runs/start', async (req: Request, res: Response) => {
  const now = Date.now()
  const last = lastRunAt.get(req.userId) ?? 0
  if (now - last < MIN_RUN_GAP_MS) {
    res.status(429).json({ error: 'Too soon' }); return
  }
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

  const safeScore   = clamp(Math.floor(score),             0, MAX_RUN_SCORE)
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

  // Compute achievements server-side from the submitted run data
  const safeBossKills   = clamp(Math.floor(bossKills   ?? 0), 0, 100)
  const safeLevel       = clamp(Math.floor(level       ?? 1), 1, 100)
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
