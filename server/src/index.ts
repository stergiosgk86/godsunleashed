import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { WebSocketServer } from 'ws'
import passport from 'passport'
import jwt from 'jsonwebtoken'
import { GameRoom } from './GameRoom.js'
import { authRouter } from './routes/auth.js'
import { apiRouter } from './routes/api.js'
import { saveRunRecord } from './runSaver.js'
import { db } from './db.js'
import { userSockets, superAdminUserIds, notifySuperAdmins } from './userSockets.js'
import type { C2SMessage } from './protocol.js'

const VALID_CHARACTER_TYPES = new Set(['ares', 'freyja', 'shade', 'zeus', 'poseidon', 'apollo', 'hades', 'chronos', 'odin', 'heimdall'])

const SECRET = process.env.JWT_SECRET!

interface AuthedWS extends WebSocket {
  userId: number
  username: string
}

const PORT = Number(process.env.PORT ?? 4000)
const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '../../dist')

// ── Express app ──────────────────────────────────────────────────────────────
const app = express()
app.use(express.json())
app.use(passport.initialize())

app.use('/auth', authRouter)
app.use('/api',  apiRouter)

// SSE clients waiting for lobby updates
const lobbyListeners = new Set<import('http').ServerResponse>()

function pushLobbyUpdate() {
  const names = openRoom ? openRoom.waitingUsernames : []
  const payload = `data: ${JSON.stringify({ playersWaiting: names.length, names })}\n\n`
  for (const res of lobbyListeners) res.write(payload)
}

// Lobby stream — SSE, no auth required
app.get('/lobby/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Send current state immediately so the client doesn't wait for the next change
  const names = openRoom ? openRoom.waitingUsernames : []
  res.write(`data: ${JSON.stringify({ playersWaiting: names.length, names })}\n\n`)

  lobbyListeners.add(res)

  // Keepalive ping every 20s — prevents QUIC/proxy from closing idle SSE connections
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20_000)
  req.on('close', () => { clearInterval(heartbeat); lobbyListeners.delete(res) })
})

// Serve the built React app for all non-API routes
app.use(express.static(DIST))
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(DIST, 'index.html'))
})

// ── HTTP + WebSocket server ──────────────────────────────────────────────────
const httpServer = createServer(app)

const wss = new WebSocketServer({ noServer: true })

// Only upgrade requests to /ws become WebSocket connections
httpServer.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://localhost`)
  if (url.pathname !== '/ws') { socket.destroy(); return }

  const token = url.searchParams.get('token') ?? ''
  let payload: { userId: number; username: string }
  try {
    payload = jwt.verify(token, SECRET) as { userId: number; username: string }
  } catch {
    wss.handleUpgrade(req, socket, head, (ws) => ws.close(4001, 'Unauthorized'))
    return
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    const authed = ws as unknown as AuthedWS
    authed.userId   = payload.userId
    authed.username = payload.username
    wss.emit('connection', ws, req)
  })
})

// ── Game logic ───────────────────────────────────────────────────────────────
let openRoom: GameRoom | null = null
let idCounter = 0

function attachGameEndHandler(room: GameRoom) {
  room.onGameEnd = (results) => {
    for (const result of results) {
      saveRunRecord(result)
        .then((newAchievements) => {
          // Find the player's WS by userId to send runSaved — room may be partially torn down,
          // so we look up the player directly via the result object's userId.
          // The `runSaved` message is sent here via the individual ws still held in the room.
          room.sendRunSaved(result.userId, {
            kills: result.kills,
            timeSurvived: result.timeSurvived,
            coins: result.coins,
            won: result.won,
            newAchievements: newAchievements.achievements,
            newWeaponUnlocks: newAchievements.weapons,
          })
        })
        .catch(err => console.error(`[runSaver] failed to save run for ${result.username}:`, err))
    }
  }
}

// Max WebSocket messages per second per connection.
// Normal gameplay: ~20 input + up to ~80 hit/projectile bursts = well under 200.
const WS_MSG_LIMIT = 200

wss.on('connection', (ws) => {
  const authed = ws as unknown as AuthedWS
  const playerId = `p${++idCounter}`
  const label = `${authed.username ?? '?'}#${playerId}`
  let room: GameRoom | null = null
  let joined = false
  let wsMsgCount = 0
  let wsMsgWindowStart = Date.now()
  userSockets.set(authed.userId, ws as unknown as import('ws').WebSocket)
  console.log(`[${label}] connected`)

  // Track super_admins for instant push without DB queries, then notify others
  db.query('SELECT role FROM users WHERE id = $1', [authed.userId])
    .then(res => {
      const isSuperAdmin = res.rows[0]?.role === 'super_admin'
      if (isSuperAdmin) superAdminUserIds.add(authed.userId)
      if (authed.username) {
        // Temporarily exclude self so a super_admin doesn't see their own connect toast
        const wasSuperAdmin = isSuperAdmin
        if (wasSuperAdmin) superAdminUserIds.delete(authed.userId)
        notifySuperAdmins(JSON.stringify({ type: 'playerOnline', username: authed.username, userId: authed.userId }))
        if (wasSuperAdmin) superAdminUserIds.add(authed.userId)
      }
    })
    .catch(() => {})

  ws.on('error', (err) => console.error(`[${label}] ws error:`, err))

  ws.on('message', async (raw) => {
    // Per-connection rate limit: close the socket if the client floods messages
    const now = Date.now()
    if (now - wsMsgWindowStart >= 1000) { wsMsgCount = 0; wsMsgWindowStart = now }
    if (++wsMsgCount > WS_MSG_LIMIT) { ws.close(4029, 'Rate limited'); return }
    let msg: C2SMessage
    try { msg = JSON.parse(raw.toString()) as C2SMessage }
    catch { return }

    if (msg.type === 'join') {
      if (joined) return
      if (!VALID_CHARACTER_TYPES.has(msg.characterType)) return
      joined = true
      console.log(`[${label}] joined as ${msg.characterType}${msg.solo ? ' (solo)' : ''}`)

      const startX = 2000 + (Math.random() - 0.5) * 200
      const startY = 2000 + (Math.random() - 0.5) * 200

      // Fetch which weapon groups this player has unlocked so the server can filter the level-up pool
      const wpRow = await db.query('SELECT unlocked_weapons FROM profiles WHERE user_id = $1', [authed.userId]).catch(() => null)
      const unlockedWeapons: string[] = wpRow?.rows[0]?.unlocked_weapons ?? []

      if (msg.solo) {
        // Solo: dedicated room that starts immediately; not shared with other players
        const soloRoom = new GameRoom(true)
        attachGameEndHandler(soloRoom)
        room = soloRoom
      } else {
        if (!openRoom || openRoom.isFull) {
          openRoom = new GameRoom()
          attachGameEndHandler(openRoom)
        }
        room = openRoom
      }

      room.addPlayer(playerId, authed.userId, ws, msg.characterType, authed.username ?? '?', startX, startY, msg.viewportW ?? 1280, msg.viewportH ?? 720, msg.resumeLevel ?? 1, msg.resumeXp ?? 0, msg.resumeElapsed ?? 0, msg.stage ?? 1, unlockedWeapons)

      if (!msg.solo && (room.isFull || room.isStarted)) {
        console.log(`[${label}] room full → game starting`)
        openRoom = null
      }
      if (!msg.solo) pushLobbyUpdate()
      return
    }

    if (!room || !joined) return

    if (msg.type === 'input') {
      room.updatePlayerPos(playerId, msg.x, msg.y, msg.aura, msg.orbital)
    } else if (msg.type === 'hit') {
      room.handleHit(playerId, msg.enemyId, msg.damage)
    } else if (msg.type === 'auraHit') {
      room.handleAuraHit(playerId, msg.enemyId, msg.damage)
    } else if (msg.type === 'died') {
      console.log(`[${label}] died`)
      room.markPlayerDead(playerId)
    } else if (msg.type === 'startGame') {
      if (room.handleStartGame(playerId)) {
        console.log(`[${label}] host started game early`)
        if (openRoom === room) openRoom = null
      }
    } else if (msg.type === 'projectile') {
      room.relayProjectile(playerId, msg.x, msg.y, msg.vx, msg.vy)
    } else if (msg.type === 'chooseUpgrade') {
      room.handleChooseUpgrade(playerId, msg.upgradeId)
    } else if (msg.type === 'pause') {
      room.pausePlayer(playerId)
    } else if (msg.type === 'resume') {
      room.resumePlayer(playerId)
    } else if (msg.type === 'adminSpawn') {
      const r = room
      if (r) {
        db.query('SELECT role FROM users WHERE id = $1', [authed.userId])
          .then(res => {
            const role = res.rows[0]?.role
            if (role === 'super_admin' || role === 'admin') r.adminSpawn(msg.entity, playerId)
          })
          .catch(() => {})
      }
    } else if (msg.type === 'adminGiveUpgrade') {
      const r = room; const { upgradeId, targetLevel } = msg
      if (r) {
        db.query('SELECT role FROM users WHERE id = $1', [authed.userId])
          .then(res => {
            const role = res.rows[0]?.role
            if (role === 'super_admin' || role === 'admin') r.adminGiveUpgrade(playerId, upgradeId, targetLevel)
          })
          .catch(() => {})
      }
    } else if (msg.type === 'collectXP') {
      if (room) room.handleCollectXP(playerId, msg.amount)
    } else if (msg.type === 'adminClearUpgrades') {
      const r = room
      if (r) {
        db.query('SELECT role FROM users WHERE id = $1', [authed.userId])
          .then(res => {
            const role = res.rows[0]?.role
            if (role === 'super_admin' || role === 'admin') r.adminClearUpgrades(playerId)
          })
          .catch(() => {})
      }
    }
  })

  ws.on('close', () => {
    if (userSockets.get(authed.userId) === (ws as unknown as import('ws').WebSocket)) {
      userSockets.delete(authed.userId)
      superAdminUserIds.delete(authed.userId)
      notifySuperAdmins(JSON.stringify({ type: 'playerOffline', userId: authed.userId }))
    }
    console.log(`[${label}] disconnected`)
    if (room) {
      const wasOpen = openRoom === room
      const empty = room.removePlayer(playerId)
      if (empty && wasOpen) { openRoom = null; pushLobbyUpdate() }
      else if (wasOpen) pushLobbyUpdate()  // player left but room still has others waiting
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`Gods Unleashed server running on http://localhost:${PORT}`)
})
