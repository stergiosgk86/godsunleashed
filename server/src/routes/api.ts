import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db.js'

export const apiRouter = Router()
apiRouter.use(requireAuth)

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
  if (typeof coins !== 'number' || typeof upgrades !== 'object' || upgrades === null) {
    res.status(400).json({ error: 'Invalid profile data' }); return
  }
  await db.query(
    'UPDATE profiles SET coins = $1, upgrades = $2::jsonb, updated_at = NOW() WHERE user_id = $3',
    [coins, JSON.stringify(upgrades), req.userId],
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
  if (typeof score !== 'number') { res.status(400).json({ error: 'Invalid' }); return }
  const user = await db.query('SELECT username FROM users WHERE id = $1', [req.userId])
  await db.query(
    `INSERT INTO runs (user_id, username, score, kills, time_survived, coins, won, multiplayer)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [req.userId, user.rows[0].username,
     score, kills ?? 0, Math.round(timeSurvived ?? 0), coins ?? 0, won ?? false, multiplayer ?? false],
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
  if (typeof achievementId !== 'string') { res.status(400).json({ error: 'Missing achievementId' }); return }
  const result = await db.query(
    `INSERT INTO user_achievements (user_id, achievement_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.userId, achievementId],
  )
  res.json({ ok: true, isNew: (result.rowCount ?? 0) > 0 })
})
