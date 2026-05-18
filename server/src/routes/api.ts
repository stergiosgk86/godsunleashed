import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'

export const apiRouter = Router()
apiRouter.use(requireAuth)

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_PROFILE_COINS = 5_000_000
const MAX_RUN_SCORE     = 10_000_000
const MAX_RUN_KILLS     = 10_000
const MAX_RUN_TIME_MS   = 32 * 60 * 1000
const MAX_SESSION_COINS = 50_000

// Must match client UPGRADE_COSTS / UPGRADE_MAX_RANK
const UPGRADE_COSTS = [10, 25, 50, 90, 150]
const MAX_UPGRADE_RANK = 5
const VALID_UPGRADE_KEYS = new Set(['maxHealth', 'recovery', 'magnet', 'might', 'luck', 'growth', 'moveSpeed'])

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
    `SELECT p.coins, p.upgrades, u.role
     FROM profiles p JOIN users u ON u.id = p.user_id
     WHERE p.user_id = $1`,
    [req.userId],
  )
  const row = result.rows[0]
  if (!row) { res.status(404).json({ error: 'Profile not found' }); return }
  res.json(row)
})

// Only upgrades are accepted here — coins are managed entirely server-side.
apiRouter.post('/profile', async (req: Request, res: Response) => {
  const { upgrades } = req.body ?? {}
  if (typeof upgrades !== 'object' || upgrades === null || Array.isArray(upgrades)) {
    res.status(400).json({ error: 'Invalid upgrades' }); return
  }
  // Validate keys and clamp values — belt-and-suspenders even though purchases are server-side
  const sanitized: Record<string, number> = {}
  for (const [key, val] of Object.entries(upgrades as Record<string, unknown>)) {
    if (!VALID_UPGRADE_KEYS.has(key) || !isFiniteNumber(val)) {
      res.status(400).json({ error: `Invalid upgrade key: ${key}` }); return
    }
    sanitized[key] = clamp(Math.floor(val as number), 0, MAX_UPGRADE_RANK)
  }
  await db.query(
    'UPDATE profiles SET upgrades = $1::jsonb, updated_at = NOW() WHERE user_id = $2',
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

apiRouter.post('/runs', async (req: Request, res: Response) => {
  const { score, kills, timeSurvived, coins, won, multiplayer } = req.body ?? {}

  if (!isFiniteNumber(score) || score < 0) {
    res.status(400).json({ error: 'Invalid score' }); return
  }

  const safeScore = clamp(Math.floor(score),         0, MAX_RUN_SCORE)
  const safeKills = clamp(Math.floor(kills    ?? 0), 0, MAX_RUN_KILLS)
  const safeTime  = clamp(Math.round(timeSurvived ?? 0), 0, MAX_RUN_TIME_MS)
  const safeCoins = clamp(Math.floor(coins    ?? 0), 0, MAX_SESSION_COINS)
  const safeWon   = won === true
  const safeMulti = multiplayer === true

  const user = await db.query('SELECT username FROM users WHERE id = $1', [req.userId])

  // Insert run record and credit coins to profile atomically
  await Promise.all([
    db.query(
      `INSERT INTO runs (user_id, username, score, kills, time_survived, coins, won, multiplayer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.userId, user.rows[0].username, safeScore, safeKills, safeTime, safeCoins, safeWon, safeMulti],
    ),
    db.query(
      `UPDATE profiles SET coins = LEAST(coins + $1, $2), updated_at = NOW() WHERE user_id = $3`,
      [safeCoins, MAX_PROFILE_COINS, req.userId],
    ),
  ])

  res.json({ ok: true })
})

// ── Achievements ──────────────────────────────────────────────────────────────

apiRouter.get('/achievements', async (req: Request, res: Response) => {
  const result = await db.query(
    `SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1`,
    [req.userId],
  )
  res.json({ achievements: result.rows })
})

apiRouter.post('/achievements/unlock', async (req: Request, res: Response) => {
  const { achievementId } = req.body ?? {}
  if (typeof achievementId !== 'string' || !VALID_ACHIEVEMENT_IDS.has(achievementId)) {
    res.status(400).json({ error: 'Unknown achievement' }); return
  }
  const result = await db.query(
    `INSERT INTO user_achievements (user_id, achievement_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.userId, achievementId],
  )
  res.json({ ok: true, isNew: (result.rowCount ?? 0) > 0 })
})
