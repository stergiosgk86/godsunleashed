import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { requireAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { db } from '../db.js'
import { userSockets, notifySuperAdmins } from '../userSockets.js'
import { ALL_WEAPON_UNLOCK_KEYS } from '../runSaver.js'

const VALID_WEAPON_UNLOCK_KEYS = new Set<string>(ALL_WEAPON_UNLOCK_KEYS)

// 60 reads/min per IP — prevents leaderboard/profile scraping
const readRateLimit = rateLimit(60, 60_000)
// 30 writes/min per IP — covers upgrade purchases, run submissions, etc.
const writeRateLimit = rateLimit(30, 60_000)

export const apiRouter = Router()
apiRouter.use(requireAuth)

async function pushProfileUpdate(userId: number) {
  const r = await db.query(
    `SELECT u.role, p.coins, p.upgrades, p.updated_at AS last_active, p.unlocked_stages
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1`,
    [userId],
  )
  if (!r.rows[0]) return
  const row = r.rows[0]
  notifySuperAdmins(JSON.stringify({ type: 'playerProfileUpdate', userId, ...row }))
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_PROFILE_COINS  = 5_000_000
// Observed solo record: ~5,100 kills. 4p doubles spawn rate so give headroom.
// Cap at 7,000 — blocks 10k submissions while allowing legitimate top runs.
// Per-sec rate check can't distinguish legit from fake (legit peak ~6.25/s)
// so keep it generous; the hard cap is the real gate.
const MAX_RUN_SCORE      = 100_000
const MAX_RUN_KILLS      = 7_000
const MAX_RUN_TIME_MS    = 32 * 60 * 1000
const MAX_SESSION_COINS  = 300    // ~3× observed best; real max is ~0.1 coins/sec
const MAX_COINS_PER_SEC  = 0.5   // generous ceiling — 5× observed max rate
const MIN_RUN_GAP_MS     = 10_000 // minimum 10 s between submissions
const RUN_DURATION_MS    = 30 * 60 * 1000  // must match client runData.ts
const MAX_KILLS_PER_SEC  = 10    // observed peak ~6.25/s; 10 covers burst AoE
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
const CHARACTER_UNLOCK_COSTS: Record<string, number> = { freyja: 100, heimdall: 150, shade: 300, zeus: 1000, poseidon: 500, apollo: 750, chronos: 1500, odin: 2000 }
// Characters unlocked automatically when a specific achievement is earned
const ACHIEVEMENT_CHARACTER_UNLOCKS: Record<string, string> = { transcendent: 'hades' }
const LOCKABLE_CHARACTERS = new Set([...Object.keys(CHARACTER_UNLOCK_COSTS), ...Object.values(ACHIEVEMENT_CHARACTER_UNLOCKS)])

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

apiRouter.get('/profile', readRateLimit, async (req: Request, res: Response) => {
  const result = await db.query(
    `SELECT p.coins, p.upgrades, p.key_bindings, p.unlocked_characters, p.unlocked_weapons, p.max_stage1_level, p.unlocked_stages, u.role
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

  // Sanitize unlocked_weapons: only keep known weapon group keys
  const rawWeapons = Array.isArray(row.unlocked_weapons) ? row.unlocked_weapons : []
  const unlockedWeapons = rawWeapons.filter((k: unknown) => typeof k === 'string' && VALID_WEAPON_UNLOCK_KEYS.has(k))

  res.json({ ...row, upgrades: sanitizedUpgrades, unlocked_characters: unlockedCharacters, unlocked_weapons: unlockedWeapons })
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
    pushProfileUpdate(req.userId).catch(() => {})
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

apiRouter.post('/upgrades/purchase', writeRateLimit, async (req: Request, res: Response) => {
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
    pushProfileUpdate(req.userId).catch(() => {})
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
    pushProfileUpdate(req.userId).catch(() => {})
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
    pushProfileUpdate(req.userId).catch(() => {})
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
      `SELECT u.id, u.username, u.role, u.created_at,
              p.coins, p.upgrades, p.updated_at AS last_active, p.unlocked_stages
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       ORDER BY u.id`,
    )
    const players = result.rows.map(row => ({
      ...row,
      online: userSockets.has(row.id) && (userSockets.get(row.id) as any)?.readyState === 1,
    }))
    res.json({ players })
  } catch (err) {
    console.error('Admin players error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

apiRouter.post('/admin/players/:id/role', async (req: Request, res: Response) => {
  try {
    const userRes = await db.query('SELECT role FROM users WHERE id = $1', [req.userId])
    if (userRes.rows[0]?.role !== 'super_admin') {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    const targetId = parseInt(req.params.id, 10)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      res.status(400).json({ error: 'Invalid user id' }); return
    }
    if (targetId === req.userId) {
      res.status(400).json({ error: 'Cannot change your own role' }); return
    }
    const { role } = req.body ?? {}
    if (role !== 'admin' && role !== null) {
      res.status(400).json({ error: 'Invalid role' }); return
    }
    // Prevent demoting another super_admin
    const targetRes = await db.query('SELECT role FROM users WHERE id = $1', [targetId])
    if (targetRes.rows[0]?.role === 'super_admin') {
      res.status(400).json({ error: 'Cannot change a super_admin role' }); return
    }
    const newRole = role ?? 'user'
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [newRole, targetId])
    const targetWs = userSockets.get(targetId)
    if (targetWs && targetWs.readyState === 1) {
      targetWs.send(JSON.stringify({ type: 'roleChanged', role: newRole }))
    }
    res.json({ ok: true, role })
    pushProfileUpdate(targetId).catch(() => {})
  } catch (err) {
    console.error('Admin set role error:', err)
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
    pushProfileUpdate(targetId).catch(() => {})
  } catch (err) {
    console.error('Admin reset error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

apiRouter.post('/admin/players/:id/full-reset', async (req: Request, res: Response) => {
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
    await Promise.all([
      db.query(
        `UPDATE profiles SET
           coins = 0,
           upgrades = $1::jsonb,
           unlocked_characters = '{}',
           unlocked_stages = '{}',
           unlocked_weapons = '{}',
           max_stage1_level = 0,
           run_snapshot = NULL,
           active_run_token = NULL,
           updated_at = NOW()
         WHERE user_id = $2`,
        [JSON.stringify(emptyUpgrades), targetId],
      ),
      db.query('DELETE FROM user_achievements WHERE user_id = $1', [targetId]),
      db.query('DELETE FROM runs WHERE user_id = $1', [targetId]),
    ])
    res.json({ ok: true })
    pushProfileUpdate(targetId).catch(() => {})
  } catch (err) {
    console.error('Admin full-reset error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

apiRouter.post('/admin/players/:id/coins', async (req: Request, res: Response) => {
  try {
    const userRes = await db.query('SELECT role FROM users WHERE id = $1', [req.userId])
    if (userRes.rows[0]?.role !== 'super_admin') {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    const targetId = parseInt(req.params.id, 10)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      res.status(400).json({ error: 'Invalid user id' }); return
    }
    const amount = parseInt(req.body.amount, 10)
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_PROFILE_COINS) {
      res.status(400).json({ error: 'Invalid amount' }); return
    }
    const result = await db.query(
      `UPDATE profiles SET coins = LEAST(coins + $1, $2), updated_at = NOW()
       WHERE user_id = $3 RETURNING coins`,
      [amount, MAX_PROFILE_COINS, targetId],
    )
    const newCoins = result.rows[0]?.coins ?? null
    res.json({ ok: true, coins: newCoins })
    pushProfileUpdate(targetId).catch(() => {})
  } catch (err) {
    console.error('Admin give coins error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

apiRouter.delete('/admin/players/:id/runs', async (req: Request, res: Response) => {
  try {
    const userRes = await db.query('SELECT role FROM users WHERE id = $1', [req.userId])
    if (userRes.rows[0]?.role !== 'super_admin') {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    const targetId = parseInt(req.params.id, 10)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      res.status(400).json({ error: 'Invalid user id' }); return
    }
    const result = await db.query('DELETE FROM runs WHERE user_id = $1', [targetId])
    res.json({ ok: true, deleted: result.rowCount })
  } catch (err) {
    console.error('Admin delete runs error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

apiRouter.post('/admin/players/:id/stages', async (req: Request, res: Response) => {
  try {
    const userRes = await db.query('SELECT role FROM users WHERE id = $1', [req.userId])
    if (userRes.rows[0]?.role !== 'super_admin') {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    const targetId = parseInt(req.params.id, 10)
    if (!Number.isInteger(targetId) || targetId <= 0) {
      res.status(400).json({ error: 'Invalid user id' }); return
    }
    const { stage, unlock } = req.body ?? {}
    const stageNum = parseInt(stage, 10)
    if (!Number.isInteger(stageNum) || stageNum < 2 || stageNum > 10) {
      res.status(400).json({ error: 'Invalid stage' }); return
    }
    const sql = unlock
      ? `UPDATE profiles SET unlocked_stages = array_append(array_remove(unlocked_stages, $1), $1), updated_at = NOW() WHERE user_id = $2 RETURNING unlocked_stages`
      : `UPDATE profiles SET unlocked_stages = array_remove(unlocked_stages, $1), updated_at = NOW() WHERE user_id = $2 RETURNING unlocked_stages`
    const result = await db.query(sql, [stageNum, targetId])
    if (result.rowCount === 0) { res.status(404).json({ error: 'Profile not found' }); return }
    res.json({ ok: true, unlocked_stages: result.rows[0].unlocked_stages })
    pushProfileUpdate(targetId).catch(() => {})
  } catch (err) {
    console.error('Admin stage unlock error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Leaderboard ───────────────────────────────────────────────────────────────

apiRouter.get('/leaderboard', readRateLimit, async (req: Request, res: Response) => {
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
apiRouter.post('/runs/start', writeRateLimit, async (req: Request, res: Response) => {
  const token = randomUUID()
  await db.query(
    'UPDATE profiles SET active_run_token = $1 WHERE user_id = $2',
    [token, req.userId],
  )
  res.json({ token })
})

apiRouter.post('/runs', writeRateLimit, async (req: Request, res: Response) => {
  const {
    runToken, score, kills, timeSurvived, coins, won, multiplayer,
    bossKills, level, damageDealt, weaponCount, tookDamage, finalHp, maxHp,
    stage, characterType,
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
  // Win conditions
  if (safeWon) {
    earned.push('god_slayer')
    if (safeFinalHp >= safeMaxHp)                         earned.push('full_health')
    if (!safeTookDamage)                                  earned.push('untouchable')
    if (safeFinalHp <= Math.ceil(safeMaxHp * 0.1))        earned.push('glass_cannon')
    if (safeMulti)                                        earned.push('champions')
  }
  // Multiplayer
  if (safeMulti && (safeWon || safeKills > 0))            earned.push('team_player')
  // Character survival
  const CHAR_30_MIN_SET = new Set(['poseidon', 'apollo', 'zeus', 'chronos', 'odin', 'hades'])
  const safeChar = VALID_CHARACTER_TYPES.has(characterType) ? characterType : ''
  if (safeChar && safeTime >= 5  * 60 * 1000) earned.push(`char_${safeChar}_5`)
  if (safeChar && safeTime >= 15 * 60 * 1000) earned.push(`char_${safeChar}_15`)
  if (safeChar && CHAR_30_MIN_SET.has(safeChar) && safeTime >= 30 * 60 * 1000) earned.push(`char_${safeChar}_30`)

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
    stage === 1
      ? db.query(
          `UPDATE profiles SET coins = LEAST(coins + $1, $2), active_run_token = NULL,
           max_stage1_level = GREATEST(max_stage1_level, $3), updated_at = NOW() WHERE user_id = $4`,
          [safeCoins, MAX_PROFILE_COINS, safeLevel, req.userId],
        )
      : db.query(
          `UPDATE profiles SET coins = LEAST(coins + $1, $2), active_run_token = NULL, updated_at = NOW() WHERE user_id = $3`,
          [safeCoins, MAX_PROFILE_COINS, req.userId],
        ),
    Promise.all(achievementInserts),
  ])

  const newlyUnlocked = achievementResults
    .flatMap(r => r.rows)
    .map(r => r.achievement_id as string)

  // Auto-unlock characters tied to newly earned achievements
  const newChars = newlyUnlocked
    .filter(id => ACHIEVEMENT_CHARACTER_UNLOCKS[id])
    .map(id => ACHIEVEMENT_CHARACTER_UNLOCKS[id])
  if (newChars.length > 0) {
    const profileResult = await db.query(
      'SELECT unlocked_characters FROM profiles WHERE user_id = $1',
      [req.userId],
    )
    const current: string[] = Array.isArray(profileResult.rows[0]?.unlocked_characters)
      ? profileResult.rows[0].unlocked_characters : []
    const merged = [...new Set([...current, ...newChars])]
    await db.query(
      'UPDATE profiles SET unlocked_characters = $1, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify(merged), req.userId],
    )
  }

  res.json({ ok: true, newAchievements: newlyUnlocked })
})

// ── Active run snapshot (page-refresh restore) ────────────────────────────────

apiRouter.put('/run-snapshot', writeRateLimit, async (req: Request, res: Response) => {
  try {
    const { snapshot } = req.body ?? {}
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      res.status(400).json({ error: 'Invalid snapshot' }); return
    }
    const json = JSON.stringify(snapshot)
    if (json.length > 131_072) { res.status(413).json({ error: 'Snapshot too large' }); return }
    await db.query(
      'UPDATE profiles SET run_snapshot = $1::jsonb WHERE user_id = $2',
      [json, req.userId],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('run-snapshot save error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

apiRouter.get('/run-snapshot', readRateLimit, async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'SELECT run_snapshot FROM profiles WHERE user_id = $1',
      [req.userId],
    )
    res.json({ snapshot: result.rows[0]?.run_snapshot ?? null })
  } catch (err) {
    console.error('run-snapshot load error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

apiRouter.delete('/run-snapshot', async (req: Request, res: Response) => {
  try {
    await db.query(
      'UPDATE profiles SET run_snapshot = NULL WHERE user_id = $1',
      [req.userId],
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('run-snapshot clear error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
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
