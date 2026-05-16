import type { WebSocket } from 'ws'
import { ServerSpawner } from './ServerSpawner.js'
import type { S2CMessage, PlayerSnapshot } from './protocol.js'

const TICK_MS = 50

interface Player {
  id: string
  ws: WebSocket
  x: number
  y: number
  characterType: string
}

export class GameRoom {
  private players: Player[] = []
  private spawner = new ServerSpawner()
  private interval: ReturnType<typeof setInterval> | null = null
  private bosses = new Map<number, number>()  // id → maxHp
  private started = false

  addPlayer(id: string, ws: WebSocket, characterType: string, x: number, y: number) {
    this.players.push({ id, ws, x, y, characterType })

    if (this.players.length === 1) {
      this.send(ws, { type: 'waiting' })
    } else {
      // Two players — start the game
      const snaps = this.playerSnapshots()
      for (const p of this.players) {
        this.send(p.ws, { type: 'start', yourId: p.id, players: snaps })
      }
      this.startLoop()
    }
  }

  updatePlayerPos(id: string, x: number, y: number) {
    const p = this.players.find(p => p.id === id)
    if (p) { p.x = x; p.y = y }
  }

  handleHit(enemyId: number, damage: number) {
    const enemy = this.spawner.findById(enemyId)
    if (!enemy || !enemy.active) return

    const died = enemy.takeDamage(damage)
    if (died) {
      this.broadcast({ type: 'enemyDied', enemyId, x: enemy.x, y: enemy.y, xpValue: enemy.xpValue })
      // Update boss HP bar if this was a boss
      if (enemy.isBoss) this.broadcast({ type: 'bossHp', bossId: enemyId, hp: 0 })
    } else if (enemy.isBoss) {
      this.broadcast({ type: 'bossHp', bossId: enemyId, hp: enemy.hp })
    }
  }

  removePlayer(id: string): boolean {
    this.players = this.players.filter(p => p.id !== id)
    this.broadcast({ type: 'playerLeft' })
    if (this.players.length === 0) {
      this.stop()
      return true  // room is empty, discard it
    }
    return false
  }

  get isFull(): boolean { return this.players.length >= 2 }
  get isEmpty(): boolean { return this.players.length === 0 }
  get isStarted(): boolean { return this.started }

  private startLoop() {
    this.started = true
    this.spawner.onBossWarning = (final) => {
      this.broadcast({ type: 'bossWarning', final })
    }
    this.spawner.onBossSpawn = (e) => {
      this.bosses.set(e.id, e.maxHp)
      this.broadcast({ type: 'bossSpawn', bossId: e.id, maxHp: e.maxHp, final: e.kind === 'finalBoss' })
    }
    this.spawner.onFinalBossDefeated = () => {
      this.broadcast({ type: 'gameOver', won: true })
      this.stop()
    }

    this.interval = setInterval(() => this.tick(), TICK_MS)
  }

  private tick() {
    const positions = this.players.map(p => ({ x: p.x, y: p.y }))
    this.spawner.update(positions, TICK_MS)

    this.broadcast({
      type: 'tick',
      enemies: this.spawner.all.map(e => e.snapshot()),
      players: this.playerSnapshots(),
      elapsed: this.spawner.runElapsed,
    })
  }

  private stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null }
  }

  private playerSnapshots(): PlayerSnapshot[] {
    return this.players.map(p => ({ id: p.id, x: p.x, y: p.y, characterType: p.characterType }))
  }

  private broadcast(msg: S2CMessage) {
    const data = JSON.stringify(msg)
    for (const p of this.players) {
      if (p.ws.readyState === 1) p.ws.send(data)
    }
  }

  private send(ws: WebSocket, msg: S2CMessage) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg))
  }
}
