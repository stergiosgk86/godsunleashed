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
import type { C2SMessage } from './protocol.js'

const VALID_CHARACTER_TYPES = new Set(['ares', 'rogue', 'witch', 'shade', 'zeus'])

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

// Public lobby status — no auth required, minimal info
app.get('/lobby/status', (_req, res) => {
  const names = openRoom ? openRoom.waitingUsernames : []
  res.json({ playersWaiting: names.length, names })
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
  console.log(`[${label}] connected`)

  ws.on('error', (err) => console.error(`[${label}] ws error:`, err))

  ws.on('message', (raw) => {
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
      console.log(`[${label}] joined as ${msg.characterType}`)

      if (!openRoom || openRoom.isFull) {
        openRoom = new GameRoom()
      }
      room = openRoom

      const startX = 2000 + (Math.random() - 0.5) * 200
      const startY = 2000 + (Math.random() - 0.5) * 200
      room.addPlayer(playerId, ws, msg.characterType, authed.username ?? '?', startX, startY)

      if (room.isFull || room.isStarted) {
        console.log(`[${label}] room full → game starting`)
        openRoom = null
      }
      return
    }

    if (!room || !joined) return

    if (msg.type === 'input') {
      room.updatePlayerPos(playerId, msg.x, msg.y, msg.aura, msg.orbital)
    } else if (msg.type === 'hit') {
      room.handleHit(playerId, msg.enemyId, msg.damage)
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
    }
  })

  ws.on('close', () => {
    console.log(`[${label}] disconnected`)
    if (room) {
      const empty = room.removePlayer(playerId)
      if (empty && openRoom === room) openRoom = null
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`Gods Unleashed server running on http://localhost:${PORT}`)
})
