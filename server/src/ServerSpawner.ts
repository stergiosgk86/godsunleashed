import { ServerEnemy } from './ServerEnemy.js'
import type { EnemyKind } from './protocol.js'

const SPAWN_INTERVAL_START = 700
const SPAWN_INTERVAL_END   = 200
const SPAWN_RADIUS   = 600
const MAX_ENEMIES    = 300
const BOSS_FIRST     = 90_000
const BOSS_REPEAT    = 120_000
const BOSS_WARNING   = 5_000
const RUN_DURATION   = 20 * 60 * 1000
const FINAL_LOCK     = RUN_DURATION - 30_000

type SpawnKind = EnemyKind

export class ServerSpawner {
  private enemies: ServerEnemy[] = []
  private elapsed = 0
  private spawnTimer = 0
  private nextBossAt = BOSS_FIRST
  private bossAlive = false
  private warningFired = false
  private finalBossAlive = false
  private finalWarningFired = false

  onBossWarning?: (final: boolean) => void
  onBossSpawn?:   (e: ServerEnemy) => void
  onFinalBossDefeated?: () => void

  get all(): ServerEnemy[] { return this.enemies }
  get runElapsed(): number  { return this.elapsed }
  get isFinished(): boolean { return this.elapsed >= RUN_DURATION && !this.finalBossAlive }

  update(players: { x: number; y: number }[], delta: number) {
    this.elapsed += delta
    this.spawnTimer += delta

    const inFinal = this.finalBossAlive || this.elapsed >= FINAL_LOCK

    // Scale difficulty by player count: √n gives 1.0× at 1p, 1.41× at 2p, 1.73× at 3p, 2.0× at 4p
    const playerScale = Math.sqrt(Math.max(1, players.length))
    const baseInterval = SPAWN_INTERVAL_START - (SPAWN_INTERVAL_START - SPAWN_INTERVAL_END) * Math.min(this.elapsed / RUN_DURATION, 1)
    const spawnInterval = baseInterval / playerScale
    const enemyCap = Math.round(MAX_ENEMIES * playerScale)
    if (!this.bossAlive && !inFinal &&
        this.spawnTimer >= spawnInterval &&
        this.enemies.length < enemyCap) {
      this.spawnTimer = 0
      this.spawnEnemy(players)
    }

    if (!inFinal) {
      if (!this.bossAlive && !this.warningFired && this.elapsed >= this.nextBossAt - BOSS_WARNING) {
        this.warningFired = true
        this.onBossWarning?.(false)
      }
      if (!this.bossAlive && this.elapsed >= this.nextBossAt) {
        const target = this.randomNear(players)
        const e = new ServerEnemy('boss', target.x, target.y)
        this.enemies.push(e)
        this.bossAlive = true
        this.onBossSpawn?.(e)
      }
    }

    if (!this.finalWarningFired && this.elapsed >= RUN_DURATION - BOSS_WARNING) {
      this.finalWarningFired = true
      this.onBossWarning?.(true)
    }
    if (!this.finalBossAlive && this.finalWarningFired && this.elapsed >= RUN_DURATION) {
      this.finalBossAlive = true
      const target = this.randomNear(players)
      const e = new ServerEnemy('finalBoss', target.x, target.y)
      this.enemies.push(e)
      this.onBossSpawn?.(e)
    }

    const speedMult = 0.6 + 0.55 * Math.min(this.elapsed / RUN_DURATION, 1)
    for (const e of this.enemies) {
      if (!e.active) continue
      const nearest = this.nearestPlayerTo(e.x, e.y, players)
      e.update(nearest.x, nearest.y, delta, speedMult)
    }

    if (this.bossAlive && !this.enemies.some(e => e.kind === 'boss' && e.active)) {
      this.bossAlive = false
      this.warningFired = false
      this.nextBossAt = this.elapsed + BOSS_REPEAT
    }

    if (this.finalBossAlive && !this.enemies.some(e => e.kind === 'finalBoss' && e.active)) {
      this.finalBossAlive = false
      this.onFinalBossDefeated?.()
    }

    this.enemies = this.enemies.filter(e => e.active)
  }

  findById(id: number): ServerEnemy | undefined {
    return this.enemies.find(e => e.id === id)
  }

  private spawnEnemy(players: { x: number; y: number }[]) {
    const target = this.randomNear(players)
    const kind = this.pickKind()
    const hpMult = 1 + 2 * Math.min(this.elapsed / RUN_DURATION, 1)
    this.enemies.push(new ServerEnemy(kind, target.x, target.y, hpMult))
  }

  private nearestPlayerTo(ex: number, ey: number, players: { x: number; y: number }[]): { x: number; y: number } {
    if (players.length === 0) return { x: 2000, y: 2000 }
    let nearest = players[0]
    let minDist = Infinity
    for (const p of players) {
      const dx = p.x - ex
      const dy = p.y - ey
      const d = dx * dx + dy * dy
      if (d < minDist) { minDist = d; nearest = p }
    }
    return nearest
  }

  private randomNear(players: { x: number; y: number }[]): { x: number; y: number } {
    const base = players.length > 0
      ? players[Math.floor(Math.random() * players.length)]
      : { x: 2000, y: 2000 }
    const angle = Math.random() * Math.PI * 2
    return {
      x: base.x + Math.cos(angle) * SPAWN_RADIUS,
      y: base.y + Math.sin(angle) * SPAWN_RADIUS,
    }
  }

  private pickKind(): SpawnKind {
    const pool: SpawnKind[] = ['basic', 'basic', 'basic']
    if (this.elapsed > 20_000) pool.push('speeder', 'speeder')
    if (this.elapsed > 45_000) pool.push('tank')
    if (this.elapsed > 60_000) pool.push('exploder')
    if (this.elapsed > 70_000) pool.push('ranged', 'ranged', 'exploder')
    return pool[Math.floor(Math.random() * pool.length)]
  }
}
