import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { rateLimit } from '../middleware/rateLimit.js'

// 10 login/register attempts per minute per IP
const authRateLimit = rateLimit(10, 60_000)
import { db } from '../db.js'

export const authRouter = Router()

const SECRET      = process.env.JWT_SECRET!
const SALT_ROUNDS = 12
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

function makeToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, SECRET, { expiresIn: '30d' })
}

// ── Google OAuth strategy ────────────────────────────────────────────────────
const googleConfigured = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
)

if (googleConfigured) {
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL!,
  },
  async (_accessToken, _refreshToken, profile, done) => {
    const googleId = profile.id
    const email    = profile.emails?.[0]?.value ?? null

    const client = await db.connect()
    try {
      // 1. Find by google_id
      let row = (await client.query<{ id: number; username: string }>(
        'SELECT id, username FROM users WHERE google_id = $1',
        [googleId],
      )).rows[0]

      if (!row && email) {
        // 2. Find existing local account by email → link it
        const byEmail = (await client.query<{ id: number; username: string }>(
          'SELECT id, username FROM users WHERE email = $1',
          [email],
        )).rows[0]

        if (byEmail) {
          await client.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, byEmail.id])
          row = byEmail
        }
      }

      if (!row) {
        // 3. Brand-new user — generate a username from email prefix
        const base = (email ?? googleId)
          .split('@')[0]
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .slice(0, 15)

        const tryInsert = async (name: string) => {
          await client.query('BEGIN')
          const u = (await client.query<{ id: number }>(
            'INSERT INTO users (google_id, email, username) VALUES ($1, $2, $3) RETURNING id',
            [googleId, email, name],
          )).rows[0]
          await client.query('INSERT INTO profiles (user_id) VALUES ($1)', [u.id])
          await client.query('COMMIT')
          return { id: u.id, username: name }
        }

        try {
          row = await tryInsert(base)
        } catch (err: any) {
          if (err.constraint === 'users_username_key') {
            await client.query('ROLLBACK')
            const suffix = String(Math.floor(Math.random() * 9000) + 1000)
            row = await tryInsert(`${base}_${suffix}`)
          } else {
            await client.query('ROLLBACK')
            throw err
          }
        }
      }

      done(null, { userId: row.id, username: row.username })
    } catch (err) {
      done(err as Error)
    } finally {
      client.release()
    }
  },
))

// Passport needs these for session serialization — unused (JWT is stateless)
// but required to avoid a runtime error when passport.initialize() is called.
passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user as Express.User))
} // end if (googleConfigured)

// GET /auth/google
authRouter.get('/google', (req: Request, res: Response, next) => {
  if (!googleConfigured) { res.status(503).json({ error: 'Google OAuth not configured' }); return }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next)
})

// GET /auth/google/callback
authRouter.get('/google/callback', (req: Request, res: Response, next) => {
  if (!googleConfigured) { res.status(503).json({ error: 'Google OAuth not configured' }); return }
  passport.authenticate('google', { session: false, failureRedirect: '/?error=oauth_failed' })(req, res, () => {
    const user = req.user as { userId: number; username: string }
    const token = makeToken(user.userId, user.username)
    res.redirect(`/?token=${token}`)
  })
})

// ── Local auth ───────────────────────────────────────────────────────────────

// POST /auth/register
authRouter.post('/register', authRateLimit, async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {}

  if (!USERNAME_RE.test(username ?? '')) {
    res.status(400).json({ error: 'Username must be 3–20 characters: letters, numbers, underscores only' })
    return
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS)

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const userRes = await client.query<{ id: number }>(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, hash],
    )
    const userId = userRes.rows[0].id

    await client.query('INSERT INTO profiles (user_id) VALUES ($1)', [userId])

    await client.query('COMMIT')

    res.status(201).json({ token: makeToken(userId, username), userId, username })
  } catch (err: any) {
    await client.query('ROLLBACK')
    if (err.constraint === 'users_username_key') {
      res.status(409).json({ error: 'Username already taken' })
    } else {
      console.error('Register error:', err)
      res.status(500).json({ error: 'Internal server error' })
    }
  } finally {
    client.release()
  }
})

// POST /auth/login
authRouter.post('/login', authRateLimit, async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {}

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' })
    return
  }

  const result = await db.query<{ id: number; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE username = $1',
    [username],
  )
  const user = result.rows[0]

  const valid = user && await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  res.json({ token: makeToken(user.id, username), userId: user.id, username })
})
