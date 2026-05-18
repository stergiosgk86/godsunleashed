import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'

export const apiRouter = Router()
apiRouter.use(requireAuth)

// ── Constants for input validation ───────────────────────────────────────────

const MAX_PROFILE_COINS = 5_000_000
const MAX_RUN_SCORE     = 10_000_000
const MAX_RUN_KILLS     = 10_000
const MAX_RUN_TIME_MS   = 32 * 60 * 1000   // 32 min — slightly over the 30-min run cap
const MAX_SESSION_COINS = 50_000

const VALID_UPGRADE_KEYS = new Set(['maxHealth', 'recovery', 'magnet', 'might', 'luck', 'growth', 'moveSpeed'])
const MAX_UPGRADE_RANK = 5

const VALID_ACHIEVEMENT_IDS = new Set([
  'survivor_5', 'veteran', 'boss_slayer', 'hunter', 'slaughterer',
  'destroyer', 'wealthy', 'ascendant', 'transcendent', 'arsenal',
  'god_slayer', 'untouchable', 'glass_cannon', 'champions', 'team_player',
])

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v)
}

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

apiRouter.post('/profile', async (req: Request, res: Response) => {
  const { coins, upgrades } = req.body ?? {}

  if (!isFiniteNumber(coins) || typeof upgrades !== 'object' || upgrades === null || Array.isArray(upgrades)) {
    res.status(400).json({ error: 'Invalid profile data' }); return
  }

  // Validate upgrade keys and values — only known keys, ranks 0–MAX_UPGRADE_RANK
  const sanitizedUpgrades: Record<string, number> = {}
  for (const [key, val] of Object.entries(upgrades as Record<string, unknown>)) {
    if (!VALID_UPGRADE_KEYS.has(key) || !isFiniteNumber(val)) {
      res.status(400).json({ error: `Invalid upgrade key or value: ${key}` }); return
    }
    sanitizedUpgrades[key] = clamp(Math.floor(val as number), 0, MAX_UPGRADE_RANK)
  }

  const safeCo = clamp(Math.floor(coins), 0, MAX_PROFILE_COINS)

  await db.query(
    'UPDATE profiles SET coins = $1, upgrades = $2::jsonb, updated_at = NOW() WHERE user_id = $3',
    [safeCo, JSON.stringify(sanitizedUpgrades), req.userId],
  )
  res.json({ ok: true })
})

// ── Leaderboard ──────────────────────────────────────────────────────────────

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

  const safeScore    = clamp(Math.floor(score),         0, MAX_RUN_SCORE)
  const safeKills    = clamp(Math.floor(kills    ?? 0), 0, MAX_RUN_KILLS)
  const safeTime     = clamp(Math.round(timeSurvived ?? 0), 0, MAX_RUN_TIME_MS)
  const safeCoins    = clamp(Math.floor(coins    ?? 0), 0, MAX_SESSION_COINS)
  const safeWon      = won === true
  const safeMulti    = multiplayer === true

  const user = await db.query('SELECT username FROM users WHERE id = $1', [req.userId])
  await db.query(
    `INSERT INTO runs (user_id, username, score, kills, time_survived, coins, won, multiplayer)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [req.userId, user.rows[0].username, safeScore, safeKills, safeTime, safeCoins, safeWon, safeMulti],
  )
  res.json({ ok: true })
})

// ── Achievements ─────────────────────────────────────────────────────────────

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
