import { WebSocketServer } from 'ws'
import { GameRoom } from './GameRoom.js'
import type { C2SMessage } from './protocol.js'

const PORT = Number(process.env.PORT ?? 4000)
const wss = new WebSocketServer({ port: PORT })

let openRoom: GameRoom | null = null
let idCounter = 0

wss.on('connection', (ws) => {
  const playerId = `p${++idCounter}`
  let room: GameRoom | null = null
  let joined = false

  ws.on('message', (raw) => {
    let msg: C2SMessage
    try { msg = JSON.parse(raw.toString()) as C2SMessage }
    catch { return }

    if (msg.type === 'join') {
      if (joined) return
      joined = true

      if (!openRoom || openRoom.isFull) {
        openRoom = new GameRoom()
      }
      room = openRoom

      // Spawn near center of world
      const startX = 2000 + (Math.random() - 0.5) * 200
      const startY = 2000 + (Math.random() - 0.5) * 200
      room.addPlayer(playerId, ws, msg.characterType, startX, startY)

      if (room.isFull) openRoom = null
      return
    }

    if (!room || !joined) return

    if (msg.type === 'input') {
      room.updatePlayerPos(playerId, msg.x, msg.y)
    } else if (msg.type === 'hit') {
      room.handleHit(msg.enemyId, msg.damage)
    }
  })

  ws.on('close', () => {
    if (room) {
      const empty = room.removePlayer(playerId)
      if (empty && openRoom === room) openRoom = null
    }
  })
})

console.log(`Vampires server running on ws://localhost:${PORT}`)
