import type { WebSocket } from 'ws'
import { ServerSpawner } from './ServerSpawner.js'
import type { S2CMessage, PlayerSnapshot } from './protocol.js'

const TICK_MS = 50
const MAX_PLAYERS = 4
const MAX_DAMAGE  = 5_000   // cap per-hit damage from client
const MAX_COORD   = 600_000 // matches ±500 000 physics bounds with some margin
const MAX_VEL     = 2_000   // max projectile velocity component

interface Player {
  id: string
  ws: WebSocket
  x: number
  y: number
  characterType: string
  username: string
  dead: boolean
  isHost: boolean
  aura: number
  orbital: number
}

export class GameRoom {
  private players: Player[] = []
  private spawner = new ServerSpawner()
  private interval: ReturnType<typeof setInterval> | null = null
  private bosses = new Map<number, number>()  // id → maxHp
  private started = false

  addPlayer(id: string, ws: WebSocket, characterType: string, username: string, x: number, y: number) {
    if (this.started) return
    const isHost = this.players.length === 0
    this.players.push({ id, ws, x, y, characterType, username, dead: false, isHost, aura: 0, orbital: 0 })
    this.broadcastWaiting()
    if (this.players.length >= MAX_PLAYERS) {
      this.startGame()
    }
  }

  handleStartGame(requesterId: string): boolean {
    const requester = this.players.find(p => p.id === requesterId)
    if (!requester?.isHost || this.players.length < 2 || this.started) return false
    this.startGame()
    return true
  }

  private broadcastWaiting() {
    for (const p of this.players) {
      this.send(p.ws, { type: 'waiting', playerCount: this.players.length, isHost: p.isHost })
    }
  }

  private startGame() {
    if (this.started) return
    const snaps = this.playerSnapshots()
    for (const p of this.players) {
      this.send(p.ws, { type: 'start', yourId: p.id, players: snaps })
    }
    this.startLoop()
  }

  updatePlayerPos(id: string, x: number, y: number, aura: number, orbital: number) {
    if (!isFinite(x) || !isFinite(y) || Math.abs(x) > MAX_COORD || Math.abs(y) > MAX_COORD) return
    const p = this.players.find(p => p.id === id)
    if (p && !p.dead) {
      p.x = x; p.y = y
      p.aura    = Math.max(0, Math.min(10, Math.floor(aura)))
      p.orbital = Math.max(0, Math.min(10, Math.floor(orbital)))
    }
  }

  markPlayerDead(id: string) {
    const p = this.players.find(p => p.id === id)
    if (p) p.dead = true
  }

  relayProjectile(fromId: string, x: number, y: number, vx: number, vy: number) {
    if (!isFinite(x) || !isFinite(y) || !isFinite(vx) || !isFinite(vy)
        || Math.abs(vx) > MAX_VEL || Math.abs(vy) > MAX_VEL) return
    const data = JSON.stringify({ type: 'projectile', playerId: fromId, x, y, vx, vy })
    for (const p of this.players) {
      if (p.id !== fromId && p.ws.readyState === 1) p.ws.send(data)
    }
  }

  handleHit(enemyId: number, damage: number) {
    if (!Number.isInteger(enemyId) || enemyId < 0 || !isFinite(damage) || damage <= 0) return
    const safeDamage = Math.min(Math.floor(damage), MAX_DAMAGE)
    const enemy = this.spawner.findById(enemyId)
    if (!enemy || !enemy.active) return

    const died = enemy.takeDamage(safeDamage)
    if (died) {
      this.broadcast({ type: 'enemyDied', enemyId, x: enemy.x, y: enemy.y, xpValue: enemy.xpValue })
      // Update boss HP bar if this was a boss
      if (enemy.isBoss) this.broadcast({ type: 'bossHp', bossId: enemyId, hp: 0 })
    } else if (enemy.isBoss) {
      this.broadcast({ type: 'bossHp', bossId: enemyId, hp: enemy.hp })
    }
  }

  removePlayer(id: string): boolean {
    const leaving = this.players.find(p => p.id === id)
    this.players = this.players.filter(p => p.id !== id)
    // Only force-kill survivors if an alive player disconnects mid-game.
    // Dead players navigating to Main Menu should not affect living players.
    if (leaving && !leaving.dead) {
      this.broadcast({ type: 'playerLeft' })
    }
    if (this.players.length === 0) {
      this.stop()
      return true  // room is empty, discard it
    }
    return false
  }

  get isFull(): boolean { return this.players.length >= MAX_PLAYERS }
  get isEmpty(): boolean { return this.players.length === 0 }
  get isStarted(): boolean { return this.started }
  get waitingUsernames(): string[] { return this.players.map(p => p.username) }

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
    try {
      const alivePlayers = this.players.filter(p => !p.dead)
      const positions = alivePlayers.length > 0
        ? alivePlayers.map(p => ({ x: p.x, y: p.y }))
        : this.players.map(p => ({ x: p.x, y: p.y }))
      this.spawner.update(positions, TICK_MS)

      for (const e of this.spawner.all) {
        if (e.pendingProjectiles.length > 0) {
          for (const proj of e.pendingProjectiles) {
            this.broadcast({ type: 'bossProjectile', enemyId: e.id, x: proj.x, y: proj.y, vx: proj.vx, vy: proj.vy })
          }
          e.pendingProjectiles = []
        }
      }

      this.broadcast({
        type: 'tick',
        enemies: this.spawner.all.map(e => e.snapshot()),
        players: this.playerSnapshots(),
        elapsed: this.spawner.runElapsed,
      })
    } catch (err) {
      console.error('Tick error:', err)
    }
  }

  private stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null }
  }

  private playerSnapshots(): PlayerSnapshot[] {
    return this.players
      .filter(p => !p.dead)
      .map(p => ({ id: p.id, x: p.x, y: p.y, characterType: p.characterType, username: p.username, aura: p.aura, orbital: p.orbital }))
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
